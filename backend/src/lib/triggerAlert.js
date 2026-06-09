// Shared alert dispatch — extracted so both signalRunner and standalone detectors can use it.
// Checks alertRules, looks up recipient list, calls mailer, marks signal as alerted.
import supabase from './supabase.js'
import { sendAlertEmail } from './mailer.js'
import { shouldAlert, shouldAlertForAccount } from './alertRules.js'
import log from './logger.js'

async function getRecipients(account) {
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'alert_emails')
    .single()
  if (data?.value?.length) return data.value
  if (account?.rep_email) return [account.rep_email]
  return null
}

async function markAlerted(signalId) {
  await supabase
    .from('signals')
    .update({ alerted: true, alerted_at: new Date().toISOString() })
    .eq('id', signalId)
}

/**
 * Dispatch an alert for a freshly-inserted signal record.
 * Respects alert suppression rules and recipient settings.
 * Safe to call multiple times — subsequent calls are no-ops if already alerted.
 *
 * @param {{ id: string, account_id: string, contact_id?: string, signal_type: string }} signal
 */
export async function triggerAlert(signal) {
  const { data: account } = await supabase
    .from('accounts')
    .select('*')
    .eq('id', signal.account_id)
    .single()

  if (!account) return

  if (signal.contact_id) {
    const { data: contact } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', signal.contact_id)
      .single()

    if (!shouldAlert({ account, contact, signalType: signal.signal_type })) return

    const to = await getRecipients(account)
    if (!to) return

    try {
      await sendAlertEmail({ to, signal, account, contact })
      await markAlerted(signal.id)
    } catch (err) {
      log.error({ signalId: signal.id, err: err.message }, '[mailer] alert send failed')
    }
    return
  }

  const { data: contacts } = await supabase
    .from('contacts')
    .select('*')
    .eq('account_id', signal.account_id)

  if (!shouldAlertForAccount({ account, contacts, signalType: signal.signal_type })) return

  const to = await getRecipients(account)
  if (!to) return

  try {
    await sendAlertEmail({ to, signal, account, contact: null })
    await markAlerted(signal.id)
  } catch (err) {
    log.error({ signalId: signal.id, err: err.message }, '[mailer] alert send failed')
  }
}
