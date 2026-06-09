/**
 * blocker_departed — fires when a Blocker contact has changed employers,
 * indicating the primary objection may have walked out with them.
 * Source: Proxycurl with use_cache: "if-recent".
 */
import axios from 'axios'
import supabase from '../lib/supabase.js'
import log from '../lib/logger.js'
import { getDetectorState, setDetectorState } from '../lib/detectorState.js'

const DETECTOR = 'blocker_departed'
const SIGNAL_TYPE = 'blocker_departed'
const PROXYCURL_BASE = 'https://nubela.co/proxycurl/api/v2'

function stalenessMs(lostAt) {
  if (!lostAt) return 30 * 24 * 60 * 60 * 1000
  const daysSince = (Date.now() - new Date(lostAt)) / (1000 * 60 * 60 * 24)
  if (daysSince < 90) return 7 * 24 * 60 * 60 * 1000
  if (daysSince < 365) return 14 * 24 * 60 * 60 * 1000
  return 30 * 24 * 60 * 60 * 1000
}

export async function checkForAccount(account, { proxyCreditTracker } = {}) {
  const apiKey = process.env.PROXYCURL_KEY
  if (!apiKey) return []
  if (account.loss_reason === 'bad_fit') return []

  const threshold = stalenessMs(account.closed_lost_at)
  const now = Date.now()

  const eligible = (account.contacts ?? []).filter((c) => {
    if (c.tag !== 'blocker' || !c.linkedin_url) return false
    if (!c.employer_updated_at) return true
    return (now - new Date(c.employer_updated_at)) > threshold
  })

  if (!eligible.length) return []

  const fired = []

  for (const contact of eligible) {
    if (proxyCreditTracker && proxyCreditTracker.used >= proxyCreditTracker.limit) {
      log.warn({ account: account.name, contact: contact.name }, `[${DETECTOR}] Proxycurl cap reached, skipping`)
      await supabase.from('contacts').update({ proxycurl_scan_pending: true }).eq('id', contact.id)
      proxyCreditTracker.skipped = (proxyCreditTracker.skipped ?? 0) + 1
      continue
    }

    if (proxyCreditTracker) proxyCreditTracker.used++

    let profile
    try {
      const res = await axios.get(`${PROXYCURL_BASE}/linkedin`, {
        params: { url: contact.linkedin_url, use_cache: 'if-recent' },
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 15000,
      })
      profile = res.data
    } catch (err) {
      log.error({ contactId: contact.id, err: err.message }, `[${DETECTOR}] Proxycurl call failed`)
      continue
    }

    await supabase
      .from('contacts')
      .update({ employer_updated_at: new Date().toISOString(), proxycurl_scan_pending: false })
      .eq('id', contact.id)

    const currentCompany = profile?.experiences?.[0]?.company ?? null
    if (!currentCompany) continue

    const state = await getDetectorState(DETECTOR, contact.id)
    const knownEmployer = state.employer

    if (!knownEmployer) {
      await setDetectorState(DETECTOR, contact.id, { employer: currentCompany })
      continue
    }

    const changed =
      currentCompany.toLowerCase().trim() !== knownEmployer.toLowerCase().trim() &&
      !currentCompany.toLowerCase().includes(account.name.toLowerCase())

    if (!changed) continue

    try {
      const { data: signal } = await supabase
        .from('signals')
        .insert({
          account_id: account.id,
          contact_id: contact.id,
          signal_type: SIGNAL_TYPE,
          title: `Blocker ${contact.name} left ${account.name}`,
          detail: `${contact.name} (previously blocking the deal at ${account.name}) now works at ${currentCompany}. The objection may no longer be in play.`,
          source_url: contact.linkedin_url,
          raw_data: { previous_employer: knownEmployer, current_company: currentCompany },
        })
        .select()
        .single()

      if (signal) fired.push(signal)
    } catch (err) {
      log.error({ contactId: contact.id, err: err.message }, `[${DETECTOR}] insert failed`)
    }

    await setDetectorState(DETECTOR, contact.id, { employer: currentCompany })
  }

  log.info({ fired: fired.length, checked: eligible.length, account: account.name }, `[${DETECTOR}] account scan done`)
  return fired
}

export async function checkBlockerDeparted() {
  const apiKey = process.env.PROXYCURL_KEY
  if (!apiKey) {
    log.warn(`[${DETECTOR}] PROXYCURL_KEY not set, skipping`)
    return []
  }

  const { data: accounts, error } = await supabase
    .from('accounts')
    .select('*, contacts(*)')

  if (error) {
    log.error({ err: error.message }, `[${DETECTOR}] failed to load accounts`)
    return []
  }

  const fired = []
  for (const account of accounts ?? []) {
    fired.push(...await checkForAccount(account))
  }

  log.info({ fired: fired.length }, `[${DETECTOR}] scan complete`)
  return fired
}
