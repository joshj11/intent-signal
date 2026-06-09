// Human-readable alert summaries per signal type.
// Used in email subjects and notification previews.
// Each function receives (account, signal) and returns a plain string.

export const ALERT_TEMPLATES = {
  conference_attendance: (account) =>
    `${account.name} has a contact attending an industry conference — good time to reach out.`,

  new_hire: (account) =>
    `${account.name} is actively growing their engineering or product team.`,

  funding_round: (account) =>
    `${account.name} just raised new funding — fresh budget may unlock your deal.`,

  champion_move: (account, signal) =>
    `${signal.title} — your champion is at a new company and could be a warm intro.`,

  reengagement_window: (account) =>
    `${account.name} has entered its re-engagement window based on when the deal was lost.`,

  competitor_bad_news: (account, signal) =>
    `${account.name}'s competitor is in the news for the wrong reasons — your window may be opening.`,

  blocker_departed: (account, signal) =>
    `The blocker at ${account.name} has left the company — the objection may have walked out with them.`,

  champion_new_company: (account, signal) =>
    `${signal.title} — follow your champion to their new company as a fresh opportunity.`,

  new_economic_buyer: (account) =>
    `${account.name} is hiring a new financial executive — budget conversations will follow.`,

  ma_activity: (account) =>
    `${account.name} has M&A activity — deal priorities and budget ownership may be shifting.`,

  ipo_filing: (account) =>
    `${account.name} filed an S-1 — IPO prep means budget unlocks and C-suite attention.`,

  competitor_sunset: (account, signal) =>
    `${account.name}'s competitor product is being sunset — act now before they choose a replacement.`,
}

/**
 * Returns the alert summary string for a given signal type.
 * Falls back gracefully if the type is unknown.
 */
export function getAlertSummary(signalType, account, signal) {
  const fn = ALERT_TEMPLATES[signalType]
  if (!fn) return `New signal for ${account?.name ?? 'unknown account'}: ${signalType}`
  return fn(account, signal)
}
