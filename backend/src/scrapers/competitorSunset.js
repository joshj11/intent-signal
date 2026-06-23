/**
 * competitor_sunset — fires when a Sisense competitor announces product end-of-life or deprecation.
 * Source: Perigon press. Competitor list is hardcoded in sisenseCompetitors.js.
 */
import supabase from '../lib/supabase.js'
import log from '../lib/logger.js'
import { searchPerigon } from '../lib/perigonClient.js'
import { getDetectorState, setDetectorState } from '../lib/detectorState.js'
import { shouldAlertForAccount, isDuplicate } from '../lib/alertRules.js'
import { getAllCompetitors, buildPerigonClause, detectCompetitor } from '../lib/sisenseCompetitors.js'

const DETECTOR = 'competitor_sunset'
const SIGNAL_TYPE = 'competitor_sunset'

const SUNSET_KEYWORDS = [
  'sunset', 'deprecated', 'end of life', 'discontinue',
  'shutting down', 'end of support', 'winding down',
]

function matchesSunset(text) {
  if (!text) return false
  const lower = text.toLowerCase()
  return SUNSET_KEYWORDS.some((kw) => lower.includes(kw))
}

export async function checkForAccount(account, { recentSignals = [], competitors } = {}) {
  if (!shouldAlertForAccount({ account, contacts: account.contacts ?? [], signalType: SIGNAL_TYPE })) return []
  if (isDuplicate(recentSignals, account.id, SIGNAL_TYPE)) return []

  const allCompetitors = competitors ?? await getAllCompetitors()
  const state = await getDetectorState(DETECTOR, account.id)
  const seenUrls = new Set(state.seen_urls ?? [])

  const articles = await searchPerigon(
    `(${buildPerigonClause(allCompetitors)}) AND (${SUNSET_KEYWORDS.join(' OR ')})`,
    { from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() }
  )

  let match = null
  for (const article of articles) {
    if (!article.url || seenUrls.has(article.url)) continue
    if (matchesSunset(article.title) || matchesSunset(article.description)) {
      match = article
      seenUrls.add(article.url)
      break
    }
  }

  if (!match) return []

  const competitor = detectCompetitor(match.title, allCompetitors) || detectCompetitor(match.description, allCompetitors) || 'A competitor'

  try {
    const { data: signal } = await supabase
      .from('signals')
      .insert({
        account_id: account.id,
        signal_type: SIGNAL_TYPE,
        title: `${competitor} may be sunsetting: ${match.title}`,
        detail: `${competitor} appears to be winding down a product or service. ${account.name} may urgently need a replacement.`,
        source_url: match.url,
        raw_data: { competitor, headline: match.title, url: match.url },
      })
      .select()
      .single()

    await setDetectorState(DETECTOR, account.id, {
      seen_urls: [...seenUrls].slice(-200),
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
