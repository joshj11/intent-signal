/**
 * champion_job_move — fires when a Champion contact has changed employers.
 * Source: Proxycurl LinkedIn API with use_cache: "if-recent" to avoid duplicate charges.
 * Staleness gate is tiered by how long ago the deal was lost.
 */
import axios from 'axios'
import supabase from '../lib/supabase.js'
import log from '../lib/logger.js'

const PROXYCURL_BASE = 'https://nubela.co/proxycurl/api/v2'
const SIGNAL_TYPE = 'champion_move'

/** Compute staleness threshold in ms based on how long ago the deal was lost. */
function stalenessMs(lostAt) {
  if (!lostAt) return 30 * 24 * 60 * 60 * 1000
  const daysSince = (Date.now() - new Date(lostAt)) / (1000 * 60 * 60 * 24)
  if (daysSince < 90) return 7 * 24 * 60 * 60 * 1000
  if (daysSince < 365) return 14 * 24 * 60 * 60 * 1000
  return 30 * 24 * 60 * 60 * 1000
}

/**
 * Per-account check.
 * opts.proxyCreditTracker = { used, skipped, limit } — mutated in place.
 */
export async function checkForAccount(account, { proxyCreditTracker } = {}) {
  const [keyRow, enabledRow] = await Promise.all([
    supabase.from('settings').select('value').eq('key', 'proxycurl_api_key').single(),
    supabase.from('settings').select('value').eq('key', 'proxycurl_enabled').single(),
  ])

  const apiKey = keyRow.data?.value
  const enabled = enabledRow.data?.value === true
  if (!enabled || !apiKey) return []
  if (account.loss_reason === 'bad_fit') return []

  const threshold = stalenessMs(account.closed_lost_at)
  const now = Date.now()

  const eligible = (account.contacts ?? []).filter((c) => {
    if (c.tag !== 'champion' || !c.linkedin_url) return false
    if (!c.employer_updated_at) return true
    return (now - new Date(c.employer_updated_at)) > threshold
  })

  if (!eligible.length) return []

  const fired = []

  for (const contact of eligible) {
    // Credit cap check
    if (proxyCreditTracker && proxyCreditTracker.used >= proxyCreditTracker.limit) {
      log.warn({ account: account.name, contact: contact.name }, '[champion_move] Proxycurl cap reached, skipping')
      await supabase.from('contacts').update({ proxycurl_scan_pending: true }).eq('id', contact.id)
      proxyCreditTracker.skipped = (proxyCreditTracker.skipped ?? 0) + 1
      continue
    }

    if (proxyCreditTracker) proxyCreditTracker.used++

    try {
      const res = await axios.get(`${PROXYCURL_BASE}/linkedin`, {
        params: { url: contact.linkedin_url, use_cache: 'if-recent' },
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 15000,
      })

      await supabase
        .from('contacts')
        .update({ employer_updated_at: new Date().toISOString(), proxycurl_scan_pending: false })
        .eq('id', contact.id)

      const currentCompany = res.data?.experiences?.[0]?.company
      const currentTitle = res.data?.experiences?.[0]?.title

      if (currentCompany && !account.name.toLowerCase().includes(currentCompany.toLowerCase())) {
        const { data: signal } = await supabase
          .from('signals')
          .insert({
            account_id: account.id,
            contact_id: contact.id,
            signal_type: SIGNAL_TYPE,
            title: `${contact.name} moved to ${currentCompany}`,
            detail: `Champion ${contact.name} now works at ${currentCompany} as ${currentTitle || 'unknown role'}. New company may be a target.`,
            source_url: contact.linkedin_url,
            raw_data: { current_company: currentCompany, current_title: currentTitle },
          })
          .select()
          .single()

        if (signal) fired.push(signal)
      }
    } catch (err) {
      log.error({ contactId: contact.id, err: err.message }, '[champion_move] Proxycurl failed')
    }
  }

  return fired
}

export async function checkChampionMoves() {
  const [keyRow, enabledRow] = await Promise.all([
    supabase.from('settings').select('value').eq('key', 'proxycurl_api_key').single(),
    supabase.from('settings').select('value').eq('key', 'proxycurl_enabled').single(),
  ])

  if (!enabledRow.data?.value || !keyRow.data?.value) {
    return flagContactsForManualCheck()
  }

  const { data: accounts } = await supabase
    .from('accounts')
    .select('*, contacts(*)')
    .neq('loss_reason', 'bad_fit')

  const fired = []
  for (const account of accounts ?? []) {
    fired.push(...await checkForAccount(account))
  }

  log.info({ fired: fired.length }, '[champion_move] scan complete')
  return fired
}

async function flagContactsForManualCheck() {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 30)

  const { data: champions } = await supabase
    .from('contacts')
    .select('*, accounts!inner(id, name, loss_reason)')
    .eq('tag', 'champion')
    .not('linkedin_url', 'is', null)
    .or(`employer_updated_at.is.null,employer_updated_at.lt.${cutoff.toISOString()}`)

  const reminders = []
  for (const contact of champions ?? []) {
    if (contact.accounts.loss_reason === 'bad_fit') continue

    const { data: existing } = await supabase
      .from('signals')
      .select('id')
      .eq('contact_id', contact.id)
      .eq('signal_type', 'champion_move')
      .eq('ignored', false)
      .eq('alerted', false)
      .gte('fired_at', cutoff.toISOString())
      .limit(1)

    if (existing?.length) continue

    const { data: signal } = await supabase
      .from('signals')
      .insert({
        account_id: contact.accounts.id,
        contact_id: contact.id,
        signal_type: 'champion_move',
        title: `Check ${contact.name}'s LinkedIn`,
        detail: `${contact.name} (champion at ${contact.accounts.name}) hasn't been checked in 30+ days.`,
        source_url: contact.linkedin_url,
      })
      .select()
      .single()

    if (signal) reminders.push(signal)
  }

  return reminders
}
