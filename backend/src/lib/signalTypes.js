// Canonical list of all signal_type values.
// Update migration_002.sql check constraint when adding new entries here.

/** @type {Record<string, string>} */
export const SIGNAL_TYPES = Object.freeze({
  CONFERENCE_ATTENDANCE: 'conference_attendance',
  NEW_HIRE: 'new_hire',
  FUNDING_ROUND: 'funding_round',
  CHAMPION_MOVE: 'champion_move',
  REENGAGEMENT_WINDOW: 'reengagement_window',
  COMPETITOR_BAD_NEWS: 'competitor_bad_news',
  BLOCKER_DEPARTED: 'blocker_departed',
  CHAMPION_NEW_COMPANY: 'champion_new_company',
  NEW_ECONOMIC_BUYER: 'new_economic_buyer',
  MA_ACTIVITY: 'ma_activity',
  IPO_FILING: 'ipo_filing',
  COMPETITOR_SUNSET: 'competitor_sunset',
})
