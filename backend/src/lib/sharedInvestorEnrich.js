/**
 * Shared investor enrichment — no Crunchbase required.
 *
 * Matches prospects/accounts against the investor_portfolio_companies cache
 * (scraped from Bessemer, Opus Capital, DFJ Growth, Battery Ventures).
 *
 * The cache is auto-populated on first use. Refresh it manually via
 * POST /api/investor-prospects/refresh-portfolio.
 */

import supabase from './supabase.js'
import log from './logger.js'
import { scrapeInvestorPortfolios, normalizeCompanyName } from '../scrapers/investorPortfolioScraper.js'

async function ensurePortfolioCache() {
  const { count } = await supabase
    .from('investor_portfolio_companies')
    .select('*', { count: 'exact', head: true })

  if (!count) {
    log.info('[sharedInvestors] portfolio cache empty — scraping now')
    await scrapeInvestorPortfolios()
  }
}

async function findSharedInvestors(name, domain) {
  // Domain match is most reliable — try it first
  if (domain) {
    const { data } = await supabase
      .from('investor_portfolio_companies')
      .select('investor_name')
      .eq('domain', domain)

    if (data?.length) {
      return [...new Set(data.map((r) => r.investor_name))]
    }
  }

  // Fall back to normalised name match
  const normalized = normalizeCompanyName(name)
  if (!normalized) return []

  const { data } = await supabase
    .from('investor_portfolio_companies')
    .select('investor_name')
    .eq('company_name_normalized', normalized)

  return [...new Set((data || []).map((r) => r.investor_name))]
}

async function enrichRecord(record, tableName) {
  const name = record.company_name || record.name
  if (!name) return []

  const shared = await findSharedInvestors(name, record.domain)

  const updates = {
    has_shared_investor: shared.length > 0,
    shared_investor_names: shared,
    ...(tableName === 'investor_prospects' ? { crunchbase_checked_at: new Date().toISOString() } : {}),
  }

  const { error } = await supabase.from(tableName).update(updates).eq('id', record.id)
  if (error) log.warn({ recordId: record.id, tableName, err: error.message }, '[sharedInvestors] update failed')

  return shared
}

async function enrichBatch(records, tableName) {
  await ensurePortfolioCache()

  let found = 0
  for (const record of records) {
    const shared = await enrichRecord(record, tableName)
    if (shared.length) found++
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

  await ensurePortfolioCache()

  let found = 0
  for (const prospect of stale) {
    const shared = await enrichRecord(prospect, 'investor_prospects')
    if (shared.length) found++
  }

  log.info({ checked: stale.length, found }, '[sharedInvestors] stale prospects enriched')
  return { checked: stale.length, shared_investors_found: found }
}
