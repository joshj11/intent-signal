/**
 * ipo_filing — fires when an S-1 registration appears on SEC EDGAR for the account.
 * Source: SEC EDGAR full-text search (free, no auth). 1s delay between requests.
 */
import axios from 'axios'
import supabase from '../lib/supabase.js'
import log from '../lib/logger.js'
import { getDetectorState, setDetectorState } from '../lib/detectorState.js'
import { shouldAlertForAccount, isDuplicate } from '../lib/alertRules.js'

const DETECTOR = 'ipo_filing'
const SIGNAL_TYPE = 'ipo_filing'
const EDGAR_SEARCH = 'https://efts.sec.gov/LATEST/search-index'
const LOOKBACK_DAYS = 7

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export async function checkForAccount(account, { recentSignals = [] } = {}) {
  if (!shouldAlertForAccount({ account, contacts: account.contacts ?? [], signalType: SIGNAL_TYPE })) return []
  if (isDuplicate(recentSignals, account.id, SIGNAL_TYPE)) return []

  const today = new Date()
  const startDate = new Date(today)
  startDate.setDate(today.getDate() - LOOKBACK_DAYS)
  const endStr = today.toISOString().split('T')[0]
  const startStr = startDate.toISOString().split('T')[0]

  let hits = []
  try {
    const res = await axios.get(EDGAR_SEARCH, {
      params: {
        q: `"${encodeURIComponent(account.name)}"`,
        dateRange: 'custom',
        startdt: startStr,
        enddt: endStr,
        forms: 'S-1',
      },
      timeout: 10000,
      headers: { 'User-Agent': 'Signal-App signal@yourdomain.com' },
    })
    hits = res.data?.hits?.hits ?? []
  } catch (err) {
    log.error({ accountId: account.id, err: err.message }, `[${DETECTOR}] EDGAR request failed`)
    return []
  }

  if (!hits.length) return []

  const state = await getDetectorState(DETECTOR, account.id)
  const seenIds = new Set(state.seen_accession_ids ?? [])
  const fresh = hits.filter((h) => !seenIds.has(h._id))
  if (!fresh.length) return []

  const filing = fresh[0]._source

  try {
    const { data: signal } = await supabase
      .from('signals')
      .insert({
        account_id: account.id,
        signal_type: SIGNAL_TYPE,
        title: `${account.name} filed an S-1 with the SEC`,
        detail: `S-1 filed on ${filing.file_date ?? endStr}. IPO preparation typically unlocks significant budget and drives a wave of software purchasing decisions.`,
        source_url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=${encodeURIComponent(account.name)}&type=S-1&dateb=&owner=include&count=10`,
        raw_data: { filing, fresh_count: fresh.length },
      })
      .select()
      .single()

    await setDetectorState(DETECTOR, account.id, {
      seen_accession_ids: [...seenIds, ...fresh.map((h) => h._id)].slice(-100),
    })

    return signal ? [signal] : []
  } catch (err) {
    log.error({ accountId: account.id, err: err.message }, `[${DETECTOR}] insert failed`)
    return []
  }
}

export async function checkIpoFilings() {
  const { data: accounts, error } = await supabase.from('accounts').select('*, contacts(*)')
  if (error) {
    log.error({ err: error.message }, `[${DETECTOR}] failed to load accounts`)
    return []
  }

  const { data: recentSignals } = await supabase
    .from('signals')
    .select('account_id, signal_type, fired_at, ignored')
    .eq('signal_type', SIGNAL_TYPE)
    .gte('fired_at', new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString())

  const fired = []
  for (let i = 0; i < (accounts ?? []).length; i++) {
    if (i > 0) await sleep(1000) // 1s delay between EDGAR requests
    fired.push(...await checkForAccount(accounts[i], { recentSignals: recentSignals ?? [] }))
  }

  log.info({ fired: fired.length }, `[${DETECTOR}] scan complete`)
  return fired
}
