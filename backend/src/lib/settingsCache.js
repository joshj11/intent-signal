/**
 * Lightweight settings cache — fetches all settings from Supabase once per 5 minutes.
 * Avoids N DB calls when the same key is read for each account during a scan run.
 */
import supabase from './supabase.js'

let cache = null
let cachedAt = 0
const TTL = 5 * 60 * 1000

export async function getSetting(key) {
  if (!cache || Date.now() - cachedAt > TTL) {
    const { data } = await supabase.from('settings').select('key, value')
    cache = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]))
    cachedAt = Date.now()
  }
  return cache?.[key] ?? null
}
