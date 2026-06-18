/**
 * accountScanner — orchestrates all 11 detectors for a single account or all accounts.
 * Champions are processed before Blockers (RULE 3) to protect credits for higher-value checks.
 */
import supabase from '../lib/supabase.js'
import log from '../lib/logger.js'
import { triggerAlert } from '../lib/triggerAlert.js'
import { getSetting } from '../lib/settingsCache.js'

import { checkForAccount as checkConference } from '../scrapers/conferenceScraper.js'
import { checkForAccount as checkCareers } from '../scrapers/careersScraper.js'
import { checkForAccount as checkFunding } from '../scrapers/crunchbaseScraper.js'
import { checkForAccount as checkChampionMove } from '../scrapers/linkedinScraper.js'
import { checkForAccount as checkChampionNewCo } from '../scrapers/championNewCompany.js'
import { checkForAccount as checkBlockerDeparted } from '../scrapers/blockerDeparted.js'
import { checkForAccount as checkCompetitorBadNews } from '../scrapers/competitorBadNews.js'
import { checkForAccount as checkCompetitorSunset } from '../scrapers/competitorSunset.js'
import { checkForAccount as checkEconomicBuyer } from '../scrapers/newEconomicBuyer.js'
import { checkForAccount as checkMaActivity } from '../scrapers/maActivity.js'
import { checkForAccount as checkIpoFiling } from '../scrapers/ipoFiling.js'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function buildSkippedWarnings() {
  const [perigon, adzunaId, adzunaKey, crunchbase] = await Promise.all([
    getSetting('perigon_api_key'),
    getSetting('adzuna_app_id'),
    getSetting('adzuna_app_key'),
    getSetting('crunchbase_api_key'),
  ])
  const warnings = []
  if (!perigon && !process.env.PERIGON_API_KEY) {
    warnings.push({ label: 'Perigon', affects: ['Competitor bad press', 'Competitor product sunset (news)'] })
  }
  if ((!adzunaId || !adzunaKey) && (!process.env.ADZUNA_APP_ID || !process.env.ADZUNA_APP_KEY)) {
    warnings.push({ label: 'Adzuna', affects: ['New economic buyer'] })
  }
  if (!crunchbase && !process.env.CRUNCHBASE_API_KEY) {
    warnings.push({ label: 'Crunchbase', affects: ['Funding round'] })
  }
  return warnings
}

async function loadRecentSignals(accountId) {
  const { data } = await supabase
    .from('signals')
    .select('account_id, signal_type, fired_at, ignored')
    .eq('account_id', accountId)
    .gte('fired_at', new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString())
  return data ?? []
}

/**
 * Run all 11 detectors for a single account.
 *
 * @param {string} accountId
 * @param {object} options
 * @param {{ used: number, skipped: number, limit: number }} [options.proxyCreditTracker]
 * @param {object} [options.pageCache] - shared page cache for conference scraper
 * @returns {{ signals_found, signal_types, errors, duration_ms }}
 */
export async function scanAccount(accountId, options = {}) {
  const start = Date.now()
  const { proxyCreditTracker, pageCache = {} } = options

  const { data: account, error } = await supabase
    .from('accounts')
    .select('*, contacts(*)')
    .eq('id', accountId)
    .single()

  if (error || !account) throw new Error(`Account ${accountId} not found`)

  const recentSignals = await loadRecentSignals(accountId)
  const sharedOpts = { recentSignals, proxyCreditTracker, pageCache }

  // Champions first (RULE 3), then Blockers, then account-level detectors
  const detectors = [
    { name: 'champion_move',        fn: () => checkChampionMove(account, sharedOpts) },
    { name: 'champion_new_company', fn: () => checkChampionNewCo(account, sharedOpts) },
    { name: 'blocker_departed',     fn: () => checkBlockerDeparted(account, sharedOpts) },
    { name: 'conference',           fn: () => checkConference(account, sharedOpts) },
    { name: 'careers',              fn: () => checkCareers(account, sharedOpts) },
    { name: 'funding',              fn: () => checkFunding(account, sharedOpts) },
    { name: 'competitor_bad_news',  fn: () => checkCompetitorBadNews(account, sharedOpts) },
    { name: 'competitor_sunset',    fn: () => checkCompetitorSunset(account, sharedOpts) },
    { name: 'new_economic_buyer',   fn: () => checkEconomicBuyer(account, sharedOpts) },
    { name: 'ma_activity',         fn: () => checkMaActivity(account, sharedOpts) },
    { name: 'ipo_filing',           fn: () => checkIpoFiling(account, sharedOpts) },
  ]

  const result = { signals_found: 0, signal_types: [], errors: [] }

  for (const { name, fn } of detectors) {
    try {
      const signals = await fn()
      for (const signal of signals) {
        await triggerAlert(signal)
        result.signals_found++
        if (!result.signal_types.includes(signal.signal_type)) {
          result.signal_types.push(signal.signal_type)
        }
      }
      if (signals.length) {
        log.info({ detector: name, fired: signals.length, account: account.name }, '[scanner]')
      }
    } catch (err) {
      log.error({ detector: name, err: err.message, account: account.name }, '[scanner] detector error')
      result.errors.push({ detector: name, error: err.message })
    }
  }

  // Update last_scanned_at after all detectors complete
  await supabase
    .from('accounts')
    .update({ last_scanned_at: new Date().toISOString() })
    .eq('id', accountId)

  result.duration_ms = Date.now() - start
  return result
}

/**
 * Scan all active accounts sequentially with 500ms delay.
 * Used by POST /api/scan/all and the weekly cron.
 *
 * @returns {{ accounts_scanned, signals_found, proxycurl_credits_used, proxycurl_skipped, errors }}
 */
export async function scanAllAccounts({ triggeredBy = 'manual' } = {}) {
  const weeklyCapEnv = parseInt(process.env.PROXYCURL_WEEKLY_CAP ?? '50', 10)
  const proxyCreditTracker = { used: 0, skipped: 0, limit: weeklyCapEnv }
  const pageCache = {}
  const skipped = await buildSkippedWarnings()
  if (skipped.length) {
    log.warn({ skipped: skipped.map((s) => s.label) }, '[scanner] detectors skipped due to missing API keys')
  }

  // Active accounts only, sorted by closed_lost_at ASC (oldest deals first — most time-sensitive)
  const { data: accounts, error } = await supabase
    .from('accounts')
    .select('id, name')
    .eq('status', 'active')
    .order('closed_lost_at', { ascending: true, nullsFirst: false })

  if (error) throw new Error(error.message)
  if (!accounts?.length) {
    await supabase.from('scan_runs').insert({ triggered_by: triggeredBy, accounts_scanned: 0, signals_found: 0, errors_count: 0, skipped })
    return { accounts_scanned: 0, signals_found: 0, proxycurl_credits_used: 0, proxycurl_skipped: 0, skipped }
  }

  let accountsScanned = 0
  let signalsFound = 0
  const errors = []

  for (let i = 0; i < accounts.length; i++) {
    if (i > 0) await sleep(500)
    try {
      const result = await scanAccount(accounts[i].id, { proxyCreditTracker, pageCache })
      accountsScanned++
      signalsFound += result.signals_found
      for (const e of result.errors ?? []) errors.push({ account: accounts[i].name, ...e })
    } catch (err) {
      log.error({ account: accounts[i].name, err: err.message }, '[scanner] scanAllAccounts account failed')
      errors.push({ account: accounts[i].name, error: err.message })
    }
  }

  if (proxyCreditTracker.skipped > 0) {
    log.warn(
      { limit: weeklyCapEnv, skipped: proxyCreditTracker.skipped },
      `[scanner] Proxycurl cap reached (${weeklyCapEnv} credits). ${proxyCreditTracker.skipped} contacts skipped.`
    )
  }

  await supabase.from('scan_runs').insert({
    triggered_by: triggeredBy,
    accounts_scanned: accountsScanned,
    signals_found: signalsFound,
    errors_count: errors.length,
    skipped,
  })

  return {
    accounts_scanned: accountsScanned,
    signals_found: signalsFound,
    proxycurl_credits_used: proxyCreditTracker.used,
    proxycurl_skipped: proxyCreditTracker.skipped,
    errors,
    skipped,
  }
}
