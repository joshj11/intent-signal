import axios from 'axios'
import log from './logger.js'
import { getSetting } from './settingsCache.js'

const BASE = 'https://api.goperigon.com/v1/all'

/**
 * Search Perigon for articles matching a free-text query.
 * Returns articles[], or [] on failure / missing key.
 */
export async function searchPerigon(query, { from, size = 10 } = {}) {
  const apiKey = await getSetting('perigon_api_key') || process.env.PERIGON_API_KEY
  if (!apiKey) {
    log.warn('[perigon] perigon_api_key not set, skipping')
    return []
  }

  const fromDate = from ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  try {
    const res = await axios.get(BASE, {
      headers: { 'x-api-key': apiKey },
      params: { q: query, category: 'Business,Technology', from: fromDate, sortBy: 'date', size },
      timeout: 10000,
    })
    return res.data?.articles ?? []
  } catch (err) {
    log.error({ err: err.message, query }, '[perigon] search failed')
    return []
  }
}
