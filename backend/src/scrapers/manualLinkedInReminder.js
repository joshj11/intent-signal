/**
 * Manual LinkedIn reminder — fires when Proxycurl is not configured.
 * Generates a "check this person's LinkedIn" signal every 30 days per contact
 * so reps aren't flying blind without the API.
 */
import supabase from '../lib/supabase.js'

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

/**
 * @param {object} account - account row with contacts[]
 * @param {'champion'|'blocker'} tag
 * @param {'champion_move'|'blocker_departed'} signalType
 * @returns {Promise<object[]>} signals inserted
 */
export async function generateManualReminders(account, tag, signalType) {
  if (account.loss_reason === 'bad_fit') return []

  const now = Date.now()
  const cutoff = new Date(now - THIRTY_DAYS_MS).toISOString()

  const eligible = (account.contacts ?? []).filter((c) => {
    if (c.tag !== tag || !c.linkedin_url) return false
    if (!c.employer_updated_at) return true
    return (now - new Date(c.employer_updated_at)) > THIRTY_DAYS_MS
  })

  if (!eligible.length) return []

  const fired = []

  for (const contact of eligible) {
    // Skip if a reminder was already fired for this contact in the last 30 days
    const { data: existing } = await supabase
      .from('signals')
      .select('id')
      .eq('contact_id', contact.id)
      .eq('signal_type', signalType)
      .eq('ignored', false)
      .gte('fired_at', cutoff)
      .limit(1)

    if (existing?.length) continue

    const label = tag === 'champion' ? 'Champion' : 'Blocker'
    const { data: signal } = await supabase
      .from('signals')
      .insert({
        account_id: account.id,
        contact_id: contact.id,
        signal_type: signalType,
        title: `Check ${contact.name}'s LinkedIn`,
        detail: `${label} ${contact.name} at ${account.name} hasn't been checked in 30+ days. Visit their LinkedIn to see if they've moved on.`,
        source_url: contact.linkedin_url,
      })
      .select()
      .single()

    if (signal) {
      fired.push(signal)
      // Stamp so we don't re-fire for another 30 days
      await supabase
        .from('contacts')
        .update({ employer_updated_at: new Date().toISOString() })
        .eq('id', contact.id)
    }
  }

  return fired
}
