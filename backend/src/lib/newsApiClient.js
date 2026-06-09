import axios from 'axios'
import log from './logger.js'

const NEWSAPI_BASE = 'https://newsapi.org/v2/everything'

/**
 * Search NewsAPI for articles matching a free-text query published in the last N hours.
 * Returns an array of article objects, or [] on failure.
 *
 * @param {string} query     NewsAPI q param (supports AND / OR / "phrase")
 * @param {number} lookbackHours
 * @returns {Promise<Array<{url: string, title: string, publishedAt: string, source: {name: string}}>>}
 */
export async function searchNews(query, lookbackHours = 24) {
  const apiKey = process.env.NEWS_API_KEY
  if (!apiKey) {
    log.warn('[newsapi] NEWS_API_KEY not set, skipping')
    return []
  }

  const from = new Date(Date.now() - lookbackHours * 60 * 60 * 1000).toISOString()

  try {
    const res = await axios.get(NEWSAPI_BASE, {
      params: { q: query, from, sortBy: 'publishedAt', language: 'en', pageSize: 20, apiKey },
      timeout: 10000,
    })
    return res.data?.articles ?? []
  } catch (err) {
    log.error({ err: err.message, query }, '[newsapi] search failed')
    return []
  }
}
