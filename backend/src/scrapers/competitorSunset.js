/**
 * competitor_sunset — fires when a competitor announces product end-of-life or deprecation.
 * Two sub-checks: Perigon press (A) and competitor RSS feed (B).
 * Either can fire the signal; only the first match counts per account per run.
 */
import Parser from 'rss-parser'
import supabase from '../lib/supabase.js'
import log from '../lib/logger.js'
import { searchPerigon } from '../lib/perigonClient.js'
import { getDetectorState, setDetectorState } from '../lib/detectorState.js'
import { shouldAlertForAccount, isDuplicate } from '../lib/alertRules.js'

const DETECTOR = 'competitor_sunset'
const SIGNAL_TYPE = 'competitor_sunset'

const SUNSET_KEYWORDS = [
  'sunset', 'deprecated', 'end of life', 'discontinue',
  'shutting down', 'end of support', 'winding down',
]

const rssParser = new Parser({ timeout: 15000 })

function matchesSunset(text) {
  if (!text) return false
  const lower = text.toLowerCase()
  return SUNSET_KEYWORDS.some((kw) => lower.includes(kw))
}

export async function checkForAccount(account, { recentSignals = [] } = {}) {
  if (!account.competitor?.trim()) return []
  if (!shouldAlertForAccount({ account, contacts: account.contacts ?? [], signalType: SIGNAL_TYPE })) return []
  if (isDuplicate(recentSignals, account.id, SIGNAL_TYPE)) return []

  const state = await getDetectorState(DETECTOR, account.id)
  const seenUrls = new Set(state.seen_urls ?? [])
  const seenGuids = new Set(state.seen_guids ?? [])

  let match = null

  // SUB-CHECK A — Perigon press
  const articles = await searchPerigon(
    `"${account.competitor}" AND (${SUNSET_KEYWORDS.join(' OR ')})`,
    { from: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() }
  )

  for (const article of articles) {
    if (!article.url || seenUrls.has(article.url)) continue
    if (matchesSunset(article.title) || matchesSunset(article.description)) {
      match = { source: 'press', headline: article.title, url: article.url }
      seenUrls.add(article.url)
      break
    }
  }

  // SUB-CHECK B — RSS feed (only if A didn't fire)
  if (!match && account.competitor_rss_url) {
    try {
      const feed = await rssParser.parseURL(account.competitor_rss_url)
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

      for (const item of feed.items ?? []) {
        const pub = item.pubDate ? new Date(item.pubDate) : null
        if (pub && pub < cutoff) continue
        if (item.guid && seenGuids.has(item.guid)) continue
        if (!matchesSunset(item.title) && !matchesSunset(item.contentSnippet)) continue

        match = { source: 'rss', headline: item.title ?? '(no title)', url: item.link ?? item.guid ?? '' }
        if (item.guid) seenGuids.add(item.guid)
        break
      }
    } catch (err) {
      log.warn(
        { accountId: account.id, rss: account.competitor_rss_url, err: err.message },
        `[${DETECTOR}] RSS fetch failed`
      )
    }
  }

  if (!match) return []

  try {
    const { data: signal } = await supabase
      .from('signals')
      .insert({
        account_id: account.id,
        signal_type: SIGNAL_TYPE,
        title: `${account.competitor} may be sunsetting: ${match.headline}`,
        detail: `${account.competitor} appears to be winding down a product or service. ${account.name} may urgently need a replacement.`,
        source_url: match.url,
        raw_data: { source: match.source, headline: match.headline, url: match.url },
      })
      .select()
      .single()

    await setDetectorState(DETECTOR, account.id, {
      seen_urls: [...seenUrls].slice(-200),
      seen_guids: [...seenGuids].slice(-200),
    })

    return signal ? [signal] : []
  } catch (err) {
    log.error({ accountId: account.id, err: err.message }, `[${DETECTOR}] insert failed`)
    return []
  }
}

export async function checkCompetitorSunset() {
  const { data: accounts, error } = await supabase
    .from('accounts')
    .select('*, contacts(*)')
    .not('competitor', 'is', null)

  if (error) {
    log.error({ err: error.message }, `[${DETECTOR}] failed to load accounts`)
    return []
  }

  const { data: recentSignals } = await supabase
    .from('signals')
    .select('account_id, signal_type, fired_at, ignored')
    .eq('signal_type', SIGNAL_TYPE)
    .gte('fired_at', new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString())

  const fired = []
  for (const account of accounts ?? []) {
    fired.push(...await checkForAccount(account, { recentSignals: recentSignals ?? [] }))
  }

  log.info({ fired: fired.length }, `[${DETECTOR}] scan complete`)
  return fired
}
