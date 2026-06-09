const BUDGET_SIGNALS = ['funding_round', 'new_hire']

// Single-contact check — used for contact-specific signals (e.g. champion_move).
export function shouldAlert({ account, contact, signalType }) {
  // Territory accounts: always alert, no filtering
  if (account.account_type === 'territory') return true

  if (account.loss_reason === 'bad_fit') return false
  if (contact && contact.tag === 'blocker') return false
  if (contact && contact.tag === 'evaluator') return BUDGET_SIGNALS.includes(signalType)
  // champion and economic_buyer: always alert
  return true
}

// Account-roster check — used for account-level signals (conference, new_hire, funding).
export function shouldAlertForAccount({ account, contacts, signalType }) {
  // Territory accounts: always alert, no filtering
  if (account.account_type === 'territory') return true

  if (account.loss_reason === 'bad_fit') return false

  const nonBlockers = (contacts || []).filter((c) => c.tag !== 'blocker')

  // No contacts → account-level monitoring, allow
  if (!contacts || contacts.length === 0) return true

  // All contacts are blockers → suppress
  if (nonBlockers.length === 0) return false

  // Any champion or economic buyer → always alert
  if (nonBlockers.some((c) => c.tag === 'champion' || c.tag === 'economic_buyer')) return true

  // Only evaluators remain → budget signals only
  return BUDGET_SIGNALS.includes(signalType)
}

// Returns true if the same signal type for this account was seen within 30 days
export function isDuplicate(existingSignals, accountId, signalType) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 30)

  return existingSignals.some(
    (s) =>
      s.account_id === accountId &&
      s.signal_type === signalType &&
      new Date(s.fired_at) > cutoff &&
      !s.ignored
  )
}
