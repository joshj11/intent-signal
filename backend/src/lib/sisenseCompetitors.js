/**
 * Sisense's primary competitors — hardcoded defaults.
 * Users can add custom competitors via the account form; those are stored in
 * the custom_competitors table and merged in at scan time via getAllCompetitors().
 */
import supabase from './supabase.js'

export const SISENSE_COMPETITORS = [
  'Tableau',
  'Power BI',
  'Looker',
  'Qlik',
  'ThoughtSpot',
  'MicroStrategy',
  'Domo',
  'GoodData',
  'Omni',
  'QuickSight',
  'Embeddable',
  'Luzmo',
  'Sigma',
]

// Fetch hardcoded + any user-added custom competitors
export async function getAllCompetitors() {
  const { data } = await supabase.from('custom_competitors').select('name')
  const custom = (data || []).map((r) => r.name)
  return [...new Set([...SISENSE_COMPETITORS, ...custom])]
}

// Build a Perigon OR clause from a competitors array
export function buildPerigonClause(competitors) {
  return competitors.map((c) => `"${c}"`).join(' OR ')
}

// Detect which competitor appears in text
export function detectCompetitor(text, competitors = SISENSE_COMPETITORS) {
  if (!text) return null
  const lower = text.toLowerCase()
  return competitors.find((c) => lower.includes(c.toLowerCase())) ?? null
}

// Static clause for the hardcoded list (used as fallback)
export const COMPETITORS_PERIGON_CLAUSE = buildPerigonClause(SISENSE_COMPETITORS)
