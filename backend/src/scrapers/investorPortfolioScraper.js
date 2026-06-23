/**
 * Scrapes portfolio company lists from Sisense's 4 investors whose pages
 * are server-side rendered. Insight Partners is excluded (Vue.js rendered).
 *
 * Results are cached in investor_portfolio_companies and used by
 * sharedInvestorEnrich.js instead of the Crunchbase API.
 */

import axios from 'axios'
import * as cheerio from 'cheerio'
import supabase from '../lib/supabase.js'
import log from '../lib/logger.js'

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; Signal/1.0)',
  Accept: 'text/html,application/json,*/*',
}

export function normalizeCompanyName(name) {
  return name
    .toLowerCase()
    .replace(/[,.'"\-&]/g, ' ')
    .replace(/\b(inc|ltd|llc|corp|co|limited|incorporated|plc|gmbh|bv|nv|sa|sas|srl|pvt|technologies|technology|solutions|software|systems|group|holdings)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractDomain(href) {
  if (!href) return null
  try {
    const url = new URL(href)
    // Skip internal links (same-domain paths starting with /)
    if (!href.startsWith('http')) return null
    return url.hostname.replace(/^www\./, '') || null
  } catch {
    return null
  }
}

// ─── Bessemer Venture Partners ────────────────────────────────────────────────
// https://www.bvp.com/companies — static HTML, h3 > a

async function scrapeBessemer() {
  const res = await axios.get('https://www.bvp.com/companies', { headers: HEADERS, timeout: 20000 })
  const $ = cheerio.load(res.data)
  const companies = []
  $('h3 a').each((_, el) => {
    const name = $(el).text().trim()
    if (name) companies.push({ company_name: name, domain: null })
  })
  return companies
}

// ─── Opus Capital ─────────────────────────────────────────────────────────────
// https://www.opuscapitalventures.com/portfolio — static HTML, h3 a

async function scrapeOpus() {
  const res = await axios.get('https://www.opuscapitalventures.com/portfolio', { headers: HEADERS, timeout: 20000 })
  const $ = cheerio.load(res.data)
  const companies = []
  $('h3 a').each((_, el) => {
    const name = $(el).text().trim()
    const href = $(el).attr('href')
    const domain = extractDomain(href)
    if (name) companies.push({ company_name: name, domain })
  })
  return companies
}

// ─── DFJ Growth ───────────────────────────────────────────────────────────────
// https://www.dfjgrowth.com/callback/company-list.php — JSON response with
// embedded HTML. Company name is in img[alt] or extracted from the href domain.

async function scrapeDFJ() {
  const res = await axios.get('https://www.dfjgrowth.com/callback/company-list.php', {
    headers: { ...HEADERS, Accept: 'application/json' },
    timeout: 20000,
  })
  const html = res.data?.content ?? res.data
  const $ = cheerio.load(typeof html === 'string' ? html : JSON.stringify(html))
  const companies = []

  $('a.company-listing').each((_, el) => {
    const href = $(el).attr('href') || ''
    const domain = extractDomain(href)

    // Try img alt first (logo alt text is usually the company name)
    const imgAlt = $(el).find('img').attr('alt')?.trim()
    // Fall back to any heading within the link
    const heading = $(el).find('h2, h3, h4, strong, .company-name').first().text().trim()
    const name = imgAlt || heading

    if (name) companies.push({ company_name: name, domain })
    else if (domain) {
      // Last resort: capitalise the domain as a name
      const nameFromDomain = domain.split('.')[0].replace(/-/g, ' ')
      companies.push({ company_name: nameFromDomain, domain })
    }
  })
  return companies
}

// ─── Battery Ventures ─────────────────────────────────────────────────────────
// https://www.battery.com/list-of-all-companies/ — static HTML, company names
// in <p><span> elements, one per paragraph.

async function scrapeBattery() {
  const res = await axios.get('https://www.battery.com/list-of-all-companies/', { headers: HEADERS, timeout: 20000 })
  const $ = cheerio.load(res.data)
  const companies = []
  const seen = new Set()

  $('p span').each((_, el) => {
    let name = $(el).text().trim()
    if (!name) return
    // Strip trailing asterisks (exit/acquired indicator) and parenthetical notes
    name = name.replace(/\s*\*+$/, '').replace(/\s*\(.*?\)\s*$/, '').trim()
    if (name.length < 2) return
    if (seen.has(name.toLowerCase())) return
    seen.add(name.toLowerCase())
    companies.push({ company_name: name, domain: null })
  })
  return companies
}

// ─── Main export ──────────────────────────────────────────────────────────────

const INVESTORS = [
  { name: 'Bessemer Venture Partners', scrape: scrapeBessemer },
  { name: 'Opus Capital',              scrape: scrapeOpus },
  { name: 'DFJ Growth',               scrape: scrapeDFJ },
  { name: 'Battery Ventures',         scrape: scrapeBattery },
]

export async function scrapeInvestorPortfolios() {
  const allRows = []

  for (const investor of INVESTORS) {
    try {
      const companies = await investor.scrape()
      for (const c of companies) {
        if (!c.company_name) continue
        allRows.push({
          investor_name: investor.name,
          company_name: c.company_name,
          company_name_normalized: normalizeCompanyName(c.company_name),
          domain: c.domain || null,
        })
      }
      log.info({ investor: investor.name, count: companies.length }, '[portfolio] scraped')
    } catch (err) {
      log.warn({ investor: investor.name, err: err.message }, '[portfolio] scrape failed — skipping')
    }
  }

  if (!allRows.length) {
    log.warn('[portfolio] no companies scraped — portfolio cache not updated')
    return { scraped: 0 }
  }

  // Full replacement: delete all existing rows then insert fresh batch
  await supabase.from('investor_portfolio_companies').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  for (let i = 0; i < allRows.length; i += 500) {
    const { error } = await supabase.from('investor_portfolio_companies').insert(allRows.slice(i, i + 500))
    if (error) log.warn({ err: error.message, batch: i }, '[portfolio] insert failed')
  }

  log.info({ total: allRows.length }, '[portfolio] cache refreshed')
  return { scraped: allRows.length, by_investor: Object.fromEntries(
    INVESTORS.map((inv) => [inv.name, allRows.filter((r) => r.investor_name === inv.name).length])
  )}
}
