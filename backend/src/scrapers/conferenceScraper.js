/**
 * conference_attendance — fires when a contact or company appears on a conference page.
 * Source: `conferences` DB table (id, name, url, year, scrape_selector, active).
 * Scrapes each conference at most once per day; caches in detector_state.
 */
import axios from 'axios'
import * as cheerio from 'cheerio'
import supabase from '../lib/supabase.js'
import { shouldAlertForAccount, isDuplicate } from '../lib/alertRules.js'
import { getDetectorState, setDetectorState } from '../lib/detectorState.js'
import log from '../lib/logger.js'

const SIGNAL_TYPE = 'conference_attendance'
const UA = 'Mozilla/5.0 (compatible; SignalBot/1.0)'

async function loadActiveConferences() {
  const currentYear = new Date().getFullYear()
  const { data, error } = await supabase
    .from('conferences')
    .select('id, name, url, year, scrape_selector')
    .eq('active', true)
    .gte('year', currentYear)

  if (error) {
    log.error({ err: error.message }, '[conference] failed to load conferences table')
    return []
  }
  return data ?? []
}

/**
 * Get page text for a conference, fetching fresh at most once per calendar day.
 * Shared pageCache keyed by `conferenceId:YYYY-MM-DD` avoids re-fetching within a run.
 */
async function getConferencePage(conference, pageCache) {
  const today = new Date().toISOString().split('T')[0]
  const cacheKey = `${conference.id}:${today}`

  if (Object.prototype.hasOwnProperty.call(pageCache, cacheKey)) {
    return pageCache[cacheKey]
  }

  // Check detector_state for today's cached scrape
  const state = await getDetectorState('conference_page', conference.id)
  if (state.scraped_date === today && state.text != null) {
    pageCache[cacheKey] = state.text
    return state.text
  }

  let text = null
  try {
    const res = await axios.get(conference.url, { timeout: 15000, headers: { 'User-Agent': UA } })
    const $ = cheerio.load(res.data)
    const el = conference.scrape_selector ? $(conference.scrape_selector) : $('body')
    text = el.text().toLowerCase()
    await setDetectorState('conference_page', conference.id, { scraped_date: today, text })
  } catch (err) {
    log.warn({ conferenceId: conference.id, url: conference.url, err: err.message }, '[conference] page fetch failed')
  }

  pageCache[cacheKey] = text
  return text
}

export async function checkForAccount(account, { recentSignals = [], pageCache = {} } = {}) {
  if (isDuplicate(recentSignals, account.id, SIGNAL_TYPE)) return []
  if (!shouldAlertForAccount({ account, contacts: account.contacts ?? [], signalType: SIGNAL_TYPE })) return []

  const conferences = await loadActiveConferences()
  if (!conferences.length) return []

  const nameLower = account.name.toLowerCase()
  const contactNames = (account.contacts ?? []).map((c) => c.name?.toLowerCase().trim()).filter(Boolean)

  for (const conference of conferences) {
    const text = await getConferencePage(conference, pageCache)
    if (!text) continue

    const nameMatch = text.includes(nameLower)
    const matchedContact = contactNames.length
      ? (account.contacts ?? []).find((c) => c.name && text.includes(c.name.toLowerCase().trim()))
      : null

    if (!nameMatch && !matchedContact) continue

    const matchedBy = nameMatch ? account.name : matchedContact.name

    try {
      const { data: signal } = await supabase
        .from('signals')
        .insert({
          account_id: account.id,
          signal_type: SIGNAL_TYPE,
          title: `${account.name} spotted at ${conference.name}`,
          detail: `${matchedBy} appears on the ${conference.name} ${conference.year} attendance list.`,
          source_url: conference.url,
          raw_data: { conference_id: conference.id, conference_name: conference.name, matched_by: matchedBy },
        })
        .select()
        .single()

      return signal ? [signal] : []
    } catch (err) {
      log.error({ accountId: account.id, err: err.message }, '[conference] insert failed')
      return []
    }
  }

  return []
}

export async function scrapeConferences() {
  const { data: accounts } = await supabase
    .from('accounts')
    .select('*, contacts(*)')
    .neq('loss_reason', 'bad_fit')

  const { data: recentSignals } = await supabase
    .from('signals')
    .select('account_id, signal_type, fired_at, ignored')
    .eq('signal_type', SIGNAL_TYPE)
    .gte('fired_at', new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString())

  // Shared page cache — each conference page scraped at most once per day per run
  const pageCache = {}
  const fired = []

  for (const account of accounts ?? []) {
    fired.push(...await checkForAccount(account, { recentSignals: recentSignals ?? [], pageCache }))
  }

  log.info({ fired: fired.length }, '[conference] scan complete')
  return fired
}
