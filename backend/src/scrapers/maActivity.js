/**
 * ma_activity — fires when Crunchbase shows M&A activity involving the account.
 * Checks acquisition_status change and acquiree_acquisitions card for recent events.
 * Source: Crunchbase Basic API v4.
 */
import axios from 'axios'
import supabase from '../lib/supabase.js'
import log from '../lib/logger.js'
import { getDetectorState, setDetectorState } from '../lib/detectorState.js'
import { shouldAlertForAccount, isDuplicate } from '../lib/alertRules.js'

const CB_BASE = 'https://api.crunchbase.com/api/v4'
const DETECTOR = 'ma_activity'
const SIGNAL_TYPE = 'ma_activity'
const LOOKBACK_DAYS = 7

async function fetchCbApiKey() {
  const { data } = await supabase.from('settings').select('value').eq('key', 'crunchbase_api_key').single()
  return data?.value ?? null
}

async function resolvePermalink(account, apiKey) {
  if (account.crunchbase_id) return account.crunchbase_id

  try {
    const res = await axios.post(
      `${CB_BASE}/searches/organizations`,
      {
        field_ids: ['identifier'],
        query: [{ type: 'predicate', field_id: 'website_url', operator_id: 'domain_eq', values: [account.domain] }],
        limit: 1,
      },
      { params: { user_key: apiKey }, timeout: 10000 }
    )

    const permalink = res.data?.entities?.[0]?.identifier?.permalink ?? null
    if (permalink) {
      await supabase.from('accounts').update({ crunchbase_id: permalink }).eq('id', account.id)
    }
    return permalink
  } catch {
    return null
  }
}

export async function checkForAccount(account, { recentSignals = [] } = {}) {
  if (!account.domain) return []
  if (!shouldAlertForAccount({ account, contacts: account.contacts ?? [], signalType: SIGNAL_TYPE })) return []
  if (isDuplicate(recentSignals, account.id, SIGNAL_TYPE)) return []

  const apiKey = await fetchCbApiKey()
  if (!apiKey) return []

  const permalink = await resolvePermalink(account, apiKey)
  if (!permalink) return []

  let props
  try {
    const res = await axios.get(`${CB_BASE}/entities/organizations/${permalink}`, {
      params: {
        user_key: apiKey,
        field_ids: 'acquisition_status,acquired_by_identifier,num_acquisitions',
        card_ids: 'acquiree_acquisitions',
      },
      timeout: 10000,
    })
    props = res.data?.properties ?? {}

    // Check recent acquisitions card
    const acquisitions = res.data?.cards?.acquiree_acquisitions ?? []
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - LOOKBACK_DAYS)

    const recentAcquisition = acquisitions.find((acq) => {
      const announced = acq.announced_on?.value
      return announced && new Date(announced) >= cutoff
    })

    if (recentAcquisition) {
      const announced = recentAcquisition.announced_on?.value
      const target = recentAcquisition.acquiree_identifier?.value ?? 'a company'

      const { data: signal } = await supabase
        .from('signals')
        .insert({
          account_id: account.id,
          signal_type: SIGNAL_TYPE,
          title: `${account.name} acquired ${target}`,
          detail: `${account.name} made an acquisition (announced ${announced}). New integration priorities may create re-engagement openings.`,
          raw_data: { acquisition: recentAcquisition },
        })
        .select()
        .single()

      await setDetectorState(DETECTOR, account.id, {
        acquisition_status: props.acquisition_status ?? null,
        num_acquisitions: props.num_acquisitions ?? 0,
      })

      return signal ? [signal] : []
    }
  } catch (err) {
    log.error({ accountId: account.id, permalink, err: err.message }, `[${DETECTOR}] entity fetch failed`)
    // Fall through to state-based check below
  }

  // Delta-based fallback: compare current state vs stored state
  const currentStatus = props?.acquisition_status ?? null
  const currentNumAcq = props?.num_acquisitions ?? 0
  const acquiredBy = props?.acquired_by_identifier?.value ?? null

  const state = await getDetectorState(DETECTOR, account.id)
  const prevStatus = state.acquisition_status ?? null
  const prevNumAcq = state.num_acquisitions ?? 0

  await setDetectorState(DETECTOR, account.id, {
    acquisition_status: currentStatus,
    num_acquisitions: currentNumAcq,
  })

  const isAcquired = currentStatus === 'acquired' && prevStatus !== 'acquired'
  const newAcquisitions = currentNumAcq > prevNumAcq
  if (!isAcquired && !newAcquisitions) return []

  const title = isAcquired
    ? `${account.name} is being acquired${acquiredBy ? ` by ${acquiredBy}` : ''}`
    : `${account.name} made ${currentNumAcq - prevNumAcq} new acquisition(s)`

  const detail = isAcquired
    ? `${account.name} has been acquired${acquiredBy ? ` by ${acquiredBy}` : ''}. Ownership change may reset budgets and buying decisions.`
    : `${account.name} is actively acquiring companies. New leadership and integration priorities may create re-engagement openings.`

  try {
    const { data: signal } = await supabase
      .from('signals')
      .insert({
        account_id: account.id,
        signal_type: SIGNAL_TYPE,
        title,
        detail,
        raw_data: {
          acquisition_status: currentStatus,
          acquired_by: acquiredBy,
          num_acquisitions: currentNumAcq,
          prev_num_acquisitions: prevNumAcq,
        },
      })
      .select()
      .single()

    return signal ? [signal] : []
  } catch (err) {
    log.error({ accountId: account.id, err: err.message }, `[${DETECTOR}] insert failed`)
    return []
  }
}

export async function checkMaActivity() {
  const apiKey = await fetchCbApiKey()
  if (!apiKey) {
    log.warn(`[${DETECTOR}] Crunchbase API key not configured, skipping`)
    return []
  }

  const { data: accounts, error } = await supabase
    .from('accounts')
    .select('*, contacts(*)')
    .not('domain', 'is', null)

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
