/**
 * Shared investor enrichment.
 * - enrichImportedAccounts   — runs at account import, updates accounts table
 * - enrichImportedProspects  — runs at prospect import, updates investor_prospects table
 * - enrichStaleProspects     — re-checks prospects with missing/stale crunchbase_checked_at
 */
import axios from 'axios'
import supabase from './supabase.js'
import log from './logger.js'

const CB_BASE = 'https://api.crunchbase.com/api/v4'

function normalise(name) {
  return name?.toLowerCase().trim() ?? ''
}

async function fetchCbApiKey() {
  const { data } = await supabase.from('settings').select('value').eq('key', 'crunchbase_api_key').single()
  return data?.value ?? null
}

async function fetchInvestors(permalink, apiKey) {
  try {
    const res = await axios.get(`${CB_BASE}/entities/organizations/${permalink}`, {
      params: { user_key: apiKey, card_ids: 'investors' },
      timeout: 10000,
    })
    return (res.data?.cards?.investors ?? [])
      .map((inv) => inv.investor_identifier?.value)
      .filter(Boolean)
  } catch {
    return []
  }
}

async function fetchOurInvestors(apiKey) {
  const permalink = process.env.OUR_CRUNCHBASE_PERMALINK
  if (!permalink) {
    log.warn('[sharedInvestors] OUR_CRUNCHBASE_PERMALINK not set — skipping enrichment')
    return []
  }
  const investors = await fetchInvestors(permalink, apiKey)
  log.info({ count: investors.length }, '[sharedInvestors] our investors loaded')
  return investors
}

async function resolvePermalink(record, tableName, apiKey) {
  if (record.crunchbase_id) return record.crunchbase_id
  if (!record.domain) return null

  try {
    const res = await axios.post(
      `${CB_BASE}/searches/organizations`,
      {
        field_ids: ['identifier'],
        query: [{ type: 'predicate', field_id: 'website_url', operator_id: 'domain_eq', values: [record.domain] }],
        limit: 1,
      },
      { params: { user_key: apiKey }, timeout: 10000 }
    )
    const permalink = res.data?.entities?.[0]?.identifier?.permalink ?? null
    if (permalink) {
      await supabase.from(tableName).update({ crunchbase_id: permalink }).eq('id', record.id)
    }
    return permalink
  } catch {
    log.warn({ recordId: record.id, tableName }, '[sharedInvestors] permalink lookup failed')
    return null
  }
}

async function enrichRecord(record, tableName, ourInvestors, apiKey) {
  if (!record.domain) return null

  const permalink = await resolvePermalink(record, tableName, apiKey)
  if (!permalink) return null

  const theirInvestors = await fetchInvestors(permalink, apiKey)
  const ourSet = new Set(ourInvestors.map(normalise))
  const shared = theirInvestors.filter((n) => ourSet.has(normalise(n)))

  const updates = {
    has_shared_investor: shared.length > 0,
    shared_investor_names: shared,
    ...(tableName === 'investor_prospects' ? { crunchbase_checked_at: new Date().toISOString() } : {}),
  }

  const { error } = await supabase.from(tableName).update(updates).eq('id', record.id)
  if (error) {
    log.warn({ recordId: record.id, tableName, err: error.message }, '[sharedInvestors] update failed')
  }

  return shared
}

async function enrichBatch(records, tableName) {
  const apiKey = await fetchCbApiKey()
  if (!apiKey) return 0

  const ourInvestors = await fetchOurInvestors(apiKey)
  if (!ourInvestors.length) return 0

  let found = 0
  for (const record of records) {
    const shared = await enrichRecord(record, tableName, ourInvestors, apiKey)
    if (shared?.length) found++
  }
  return found
}

export async function enrichImportedAccounts(accounts) {
  await enrichBatch(accounts, 'accounts')
}

export async function enrichImportedProspects(prospects) {
  await enrichBatch(prospects, 'investor_prospects')
}

export async function enrichStaleProspects() {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 30)

  const { data: stale, error } = await supabase
    .from('investor_prospects')
    .select('*')
    .or(`crunchbase_checked_at.is.null,crunchbase_checked_at.lt.${cutoff.toISOString()}`)

  if (error) throw new Error(error.message)
  if (!stale?.length) return { checked: 0, shared_investors_found: 0 }

  const apiKey = await fetchCbApiKey()
  if (!apiKey) return { checked: 0, shared_investors_found: 0, error: 'No Crunchbase API key configured' }

  const ourInvestors = await fetchOurInvestors(apiKey)
  if (!ourInvestors.length) return { checked: 0, shared_investors_found: 0, error: 'OUR_CRUNCHBASE_PERMALINK not configured' }

  let found = 0
  for (const prospect of stale) {
    const shared = await enrichRecord(prospect, 'investor_prospects', ourInvestors, apiKey)
    if (shared?.length) found++
  }

  log.info({ checked: stale.length, found }, '[sharedInvestors] stale prospects enriched')
  return { checked: stale.length, shared_investors_found: found }
}
