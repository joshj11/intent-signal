/**
 * funding_round — fires when a new funding round is announced within the last 7 days.
 * Source: Crunchbase Basic API v4.
 * Uses accounts.crunchbase_id (permalink) for direct entity lookup when available;
 * falls back to domain search and caches the permalink for next time.
 */
import axios from 'axios'
import supabase from '../lib/supabase.js'
import { shouldAlertForAccount, isDuplicate } from '../lib/alertRules.js'
import log from '../lib/logger.js'

const CB_BASE = 'https://api.crunchbase.com/api/v4'
const SIGNAL_TYPE = 'funding_round'
const LOOKBACK_DAYS = 7

async function fetchCbApiKey() {
  const { data } = await supabase.from('settings').select('value').eq('key', 'crunchbase_api_key').single()
  return data?.value ?? null
}

/** Resolve org permalink from domain, caching result in accounts.crunchbase_id. */
async function resolvePermalink(account, apiKey) {
  if (account.crunchbase_id) return account.crunchbase_id

  try {
    const res = await axios.post(
      `${CB_BASE}/searches/organizations`,
      {
        field_ids: ['identifier'],
        query: [{ type: 'predicate', field_id: 'website_url', operator_id: 'domain_eq', values: [account.domain] }],
        limit: 1,
      },
      { params: { user_key: apiKey }, timeout: 10000 }
    )

    const permalink = res.data?.entities?.[0]?.identifier?.permalink ?? null
    if (permalink) {
      await supabase.from('accounts').update({ crunchbase_id: permalink }).eq('id', account.id)
    }
    return permalink
  } catch {
    return null
  }
}

/** Fetch org entity properties by permalink. */
async function fetchOrgProps(permalink, apiKey, fieldIds) {
  const res = await axios.get(`${CB_BASE}/entities/organizations/${permalink}`, {
    params: { user_key: apiKey, field_ids: fieldIds.join(',') },
    timeout: 10000,
  })
  return res.data?.properties ?? null
}

export async function checkForAccount(account, { recentSignals = [] } = {}) {
  if (!account.domain) return []
  if (isDuplicate(recentSignals, account.id, SIGNAL_TYPE)) return []
  if (!shouldAlertForAccount({ account, contacts: account.contacts ?? [], signalType: SIGNAL_TYPE })) return []

  const apiKey = await fetchCbApiKey()
  if (!apiKey) return []

  const permalink = await resolvePermalink(account, apiKey)
  if (!permalink) return []

  let props
  try {
    props = await fetchOrgProps(permalink, apiKey, ['last_funding_at', 'last_funding_type', 'funding_total'])
  } catch (err) {
    log.error({ accountId: account.id, permalink, err: err.message }, '[funding_round] entity fetch failed')
    return []
  }

  const fundedAt = props?.last_funding_at
  if (!fundedAt) return []

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - LOOKBACK_DAYS)
  if (new Date(fundedAt) < cutoff) return []

  const amount = props.funding_total?.value_usd
  const amountStr = amount ? `$${(amount / 1_000_000).toFixed(1)}M` : 'undisclosed amount'

  try {
    const { data: signal } = await supabase
      .from('signals')
      .insert({
        account_id: account.id,
        signal_type: SIGNAL_TYPE,
        title: `${account.name} raised ${amountStr}`,
        detail: `${props.last_funding_type || 'Funding round'} closed ${fundedAt}. Total funding: ${amountStr}.`,
        raw_data: { type: props.last_funding_type, amount, date: fundedAt },
      })
      .select()
      .single()

    return signal ? [signal] : []
  } catch (err) {
    log.error({ accountId: account.id, err: err.message }, '[funding_round] insert failed')
    return []
  }
}

export async function checkFundingRounds() {
  const apiKey = await fetchCbApiKey()
  if (!apiKey) {
    log.info('[crunchbase] No API key configured, skipping')
    return []
  }

  const { data: accounts } = await supabase
    .from('accounts')
    .select('*, contacts(*)')
    .neq('loss_reason', 'bad_fit')
    .not('domain', 'is', null)

  const { data: recentSignals } = await supabase
    .from('signals')
    .select('account_id, signal_type, fired_at, ignored')
    .eq('signal_type', SIGNAL_TYPE)
    .gte('fired_at', new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString())

  const fired = []
  for (const account of accounts ?? []) {
    fired.push(...await checkForAccount(account, { recentSignals: recentSignals ?? [] }))
  }

  log.info({ fired: fired.length }, '[funding_round] scan complete')
  return fired
}
