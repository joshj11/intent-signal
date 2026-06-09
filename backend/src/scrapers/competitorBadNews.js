/**
 * competitor_bad_news — fires when a closed-lost competitor appears in negative press.
 * Source: Perigon API (replaces NewsAPI).
 */
import supabase from '../lib/supabase.js'
import log from '../lib/logger.js'
import { searchPerigon } from '../lib/perigonClient.js'
import { getDetectorState, setDetectorState } from '../lib/detectorState.js'
import { shouldAlertForAccount, isDuplicate } from '../lib/alertRules.js'

const DETECTOR = 'competitor_bad_news'
const SIGNAL_TYPE = 'competitor_bad_news'
const BAD_NEWS_KEYWORDS = ['acquired', 'pricing', 'layoffs', 'shutdown', 'breach', 'outage']

export async function checkForAccount(account, { recentSignals = [] } = {}) {
  if (!account.competitor?.trim()) return []
  if (!shouldAlertForAccount({ account, contacts: account.contacts ?? [], signalType: SIGNAL_TYPE })) return []
  if (isDuplicate(recentSignals, account.id, SIGNAL_TYPE)) return []

  const articles = await searchPerigon(
    `"${account.competitor}" AND (${BAD_NEWS_KEYWORDS.join(' OR ')})`,
    { from: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() }
  )
  if (!articles.length) return []

  const state = await getDetectorState(DETECTOR, account.id)
  const seenUrls = new Set(state.seen_urls ?? [])

  const fresh = articles.filter(
    (a) => a.url && !seenUrls.has(a.url) &&
      (BAD_NEWS_KEYWORDS.some((kw) => a.title?.toLowerCase().includes(kw) || a.description?.toLowerCase().includes(kw)))
  )
  if (!fresh.length) return []

  const article = fresh[0]

  try {
    const { data: signal } = await supabase
      .from('signals')
      .insert({
        account_id: account.id,
        signal_type: SIGNAL_TYPE,
        title: `${account.competitor} in the news: ${article.title}`,
        detail: `Negative press about ${account.competitor} may create re-engagement opportunities at ${account.name}.`,
        source_url: article.url,
        raw_data: { article, all_fresh_count: fresh.length },
      })
      .select()
      .single()

    await setDetectorState(DETECTOR, account.id, {
      seen_urls: [...seenUrls, ...fresh.map((a) => a.url)].slice(-200),
    })

    return signal ? [signal] : []
  } catch (err) {
    log.error({ accountId: account.id, err: err.message }, `[${DETECTOR}] insert failed`)
    return []
  }
}

export async function checkCompetitorBadNews() {
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
