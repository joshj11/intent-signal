/**
 * engineering_hiring — fires when a company's careers page shows engineering/product roles.
 * Requires accounts.careers_url. Fires when matched_count increases vs stored state.
 */
import axios from 'axios'
import * as cheerio from 'cheerio'
import supabase from '../lib/supabase.js'
import { shouldAlertForAccount, isDuplicate } from '../lib/alertRules.js'
import { getDetectorState, setDetectorState } from '../lib/detectorState.js'
import log from '../lib/logger.js'

const SIGNAL_TYPE = 'new_hire'
const UA = 'Mozilla/5.0 (compatible)'

// Multi-word phrases reduce false positives from titles like "Netsuite Engineer" or "Sales Engineer"
const TITLE_KEYWORDS = [
  'software engineer', 'software developer', 'product manager', 'product designer',
  'devops engineer', 'platform engineer', 'site reliability', 'data engineer',
  'data scientist', 'backend engineer', 'frontend engineer', 'full stack',
  'fullstack engineer', 'machine learning', 'ml engineer', 'engineering manager',
  'head of engineering', 'vp engineering', 'vp of engineering',
  'infrastructure engineer', 'cloud engineer', 'solutions engineer',
  'senior engineer', 'staff engineer', 'principal engineer', 'junior engineer', 'lead engineer',
  'head of product', 'vp product', 'vp of product', 'director of product', 'chief product officer', 'cpo',
  'senior product manager', 'lead product manager', 'group product manager',
]

const JOB_SELECTORS = ['.jobs', '.careers', '.positions', '#jobs', '[data-job]', 'main']

function extractJobTitles($) {
  for (const sel of JOB_SELECTORS) {
    const el = $(sel)
    if (el.length) {
      return el.find('a, h2, h3, li').map((_, e) => $(e).text().trim()).get()
    }
  }
  return $('body').find('a, h2, h3, li').map((_, e) => $(e).text().trim()).get()
}

async function fetchPage(url) {
  try {
    const res = await axios.get(url, { timeout: 10000, headers: { 'User-Agent': UA } })
    return { url, html: res.data }
  } catch {
    return null
  }
}

async function findCareersPage(account) {
  if (account.careers_url) return fetchPage(account.careers_url)

  // Auto-discover from domain
  for (const url of [
    `https://${account.domain}/careers`,
    `https://${account.domain}/jobs`,
    `https://jobs.${account.domain}`,
    `https://${account.domain}/about/careers`,
  ]) {
    const result = await fetchPage(url)
    if (result) return result
  }
  return null
}

export async function checkForAccount(account, { recentSignals = [] } = {}) {
  if (!account.domain && !account.careers_url) return []
  if (isDuplicate(recentSignals, account.id, SIGNAL_TYPE)) return []
  if (!shouldAlertForAccount({ account, contacts: account.contacts ?? [], signalType: SIGNAL_TYPE })) return []

  const result = await findCareersPage(account)

  // Always update detector_state so the coverage UI stays accurate
  await setDetectorState('careers', account.id, {
    found: !!result,
    url: result?.url ?? null,
    tried_at: new Date().toISOString(),
  })

  if (!result) return []

  const $ = cheerio.load(result.html)
  const rawTitles = extractJobTitles($)

  // Deduplicate case-insensitively, keep original casing of first occurrence
  const matchedJobs = [
    ...new Map(
      rawTitles
        .filter((t) => t.length > 3 && t.length < 100 && TITLE_KEYWORDS.some((kw) => t.toLowerCase().includes(kw)))
        .map((t) => [t.toLowerCase().trim(), t.trim()])
    ).values(),
  ]
  const matchedCount = matchedJobs.length

  // Only fire if matched_count increased vs stored value
  const state = await getDetectorState('careers', account.id)
  const prevCount = state.matched_count ?? 0

  await setDetectorState('careers', account.id, {
    found: true,
    url: result.url,
    tried_at: new Date().toISOString(),
    matched_count: matchedCount,
    matched_jobs: matchedJobs,
  })

  if (matchedCount === 0 || matchedCount <= prevCount) return []

  const roleList = matchedJobs.slice(0, 4).join(', ') + (matchedJobs.length > 4 ? ` +${matchedJobs.length - 4} more` : '')

  try {
    const { data: signal } = await supabase
      .from('signals')
      .insert({
        account_id: account.id,
        signal_type: SIGNAL_TYPE,
        title: `${account.name} is hiring engineering/product`,
        detail: `Open roles: ${roleList}`,
        source_url: result.url,
        raw_data: { matched_count: matchedCount, matched_jobs: matchedJobs },
      })
      .select()
      .single()

    return signal ? [signal] : []
  } catch (err) {
    log.error({ accountId: account.id, err: err.message }, '[new_hire] insert failed')
    return []
  }
}

export async function scrapeCareers() {
  const { data: accounts } = await supabase
    .from('accounts')
    .select('*, contacts(*)')
    .neq('loss_reason', 'bad_fit')
    .not('domain', 'is', null)

  const { data: recentSignals } = await supabase
    .from('signals')
    .select('account_id, signal_type, fired_at, ignored')
    .eq('signal_type', SIGNAL_TYPE)
    .gte('fired_at', new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString())

  const fired = []
  for (const account of accounts ?? []) {
    fired.push(...await checkForAccount(account, { recentSignals: recentSignals ?? [] }))
  }

  log.info({ fired: fired.length }, '[new_hire] scan complete')
  return fired
}
