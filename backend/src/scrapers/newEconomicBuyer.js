/**
 * new_economic_buyer — fires when a company posts a senior finance or revenue leadership role.
 * Source: Adzuna. Market configurable via ADZUNA_MARKET env (default: gb).
 */
import axios from 'axios'
import supabase from '../lib/supabase.js'
import log from '../lib/logger.js'
import { getDetectorState, setDetectorState } from '../lib/detectorState.js'
import { shouldAlertForAccount, isDuplicate } from '../lib/alertRules.js'

const DETECTOR = 'new_economic_buyer'
const SIGNAL_TYPE = 'new_economic_buyer'

const EXEC_TITLES = [
  'CFO',
  'CRO',
  '"VP Finance"',
  '"Head of Finance"',
  '"Chief Financial Officer"',
  '"Chief Revenue Officer"',
]

function adzunaBase() {
  const market = process.env.ADZUNA_MARKET || 'gb'
  return `https://api.adzuna.com/v1/api/jobs/${market}/search/1`
}

export async function checkForAccount(account, { recentSignals = [] } = {}) {
  const appId = process.env.ADZUNA_APP_ID
  const appKey = process.env.ADZUNA_APP_KEY
  if (!appId || !appKey) return []

  if (!shouldAlertForAccount({ account, contacts: account.contacts ?? [], signalType: SIGNAL_TYPE })) return []
  if (isDuplicate(recentSignals, account.id, SIGNAL_TYPE)) return []

  let results = []
  try {
    const res = await axios.get(adzunaBase(), {
      params: {
        app_id: appId,
        app_key: appKey,
        what_or: EXEC_TITLES.join(' '),
        title_only: 1,
        company: account.name,
        results_per_page: 5,
        sort_by: 'date',
      },
      timeout: 10000,
    })
    results = res.data?.results ?? []
  } catch (err) {
    log.error({ accountId: account.id, err: err.message }, `[${DETECTOR}] Adzuna call failed`)
    return []
  }

  const accountLower = account.name.toLowerCase()
  const relevant = results.filter((job) => {
    const jobCompany = job.company?.display_name?.toLowerCase() ?? ''
    return jobCompany.includes(accountLower) || accountLower.includes(jobCompany)
  })
  if (!relevant.length) return []

  const state = await getDetectorState(DETECTOR, account.id)
  const seenIds = new Set(state.seen_job_ids ?? [])
  const fresh = relevant.filter((job) => !seenIds.has(job.id))
  if (!fresh.length) return []

  const job = fresh[0]

  try {
    const { data: signal } = await supabase
      .from('signals')
      .insert({
        account_id: account.id,
        signal_type: SIGNAL_TYPE,
        title: `${account.name} hiring ${job.title}`,
        detail: `A new financial or revenue leader is being hired at ${account.name} — budget ownership and buying decisions may shift.`,
        source_url: job.redirect_url ?? null,
        raw_data: { job, fresh_count: fresh.length },
      })
      .select()
      .single()

    await setDetectorState(DETECTOR, account.id, {
      seen_job_ids: [...seenIds, ...fresh.map((j) => j.id)].slice(-500),
    })

    return signal ? [signal] : []
  } catch (err) {
    log.error({ accountId: account.id, err: err.message }, `[${DETECTOR}] insert failed`)
    return []
  }
}

export async function checkNewEconomicBuyer() {
  const appId = process.env.ADZUNA_APP_ID
  const appKey = process.env.ADZUNA_APP_KEY
  if (!appId || !appKey) {
    log.warn(`[${DETECTOR}] ADZUNA_APP_ID / ADZUNA_APP_KEY not set, skipping`)
    return []
  }

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
  for (const account of accounts ?? []) {
    fired.push(...await checkForAccount(account, { recentSignals: recentSignals ?? [] }))
  }

  log.info({ fired: fired.length }, `[${DETECTOR}] scan complete`)
  return fired
}
