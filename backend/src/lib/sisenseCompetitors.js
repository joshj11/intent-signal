/**
 * Sisense's primary competitors — hardcoded, same as investor list.
 * Update this list as the competitive landscape shifts.
 */
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

// Perigon OR clause: ("Tableau" OR "Power BI" OR ...)
export const COMPETITORS_PERIGON_CLAUSE =
  SISENSE_COMPETITORS.map((c) => `"${c}"`).join(' OR ')

// Detect which competitor appears in an article title or description
export function detectCompetitor(text) {
  if (!text) return null
  const lower = text.toLowerCase()
  return SISENSE_COMPETITORS.find((c) => lower.includes(c.toLowerCase())) ?? null
}
