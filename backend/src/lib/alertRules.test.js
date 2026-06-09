// Edge case tests for alert suppression logic.
// Run with: node --test src/lib/alertRules.test.js
//
// Covers:
//   - bad_fit suppression (all signal types)
//   - blocker suppression (single contact and all-blocker roster)
//   - evaluator: budget signals only
//   - champion: always alert
//   - mixed rosters: champion wins over evaluator
//   - no contacts: account-level signals pass through
//   - 30-day dedup window
//   - re-engagement: dedup respects ignored flag

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { shouldAlert, shouldAlertForAccount, isDuplicate } from './alertRules.js'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const account = (loss_reason) => ({ id: 'acct-1', loss_reason })
const contact = (tag) => ({ id: 'c-1', tag })

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

// ─── shouldAlert (single-contact) ────────────────────────────────────────────

test('bad_fit account never alerts regardless of contact tag', () => {
  const acct = account('bad_fit')
  assert.equal(shouldAlert({ account: acct, contact: contact('champion'), signalType: 'funding_round' }), false)
  assert.equal(shouldAlert({ account: acct, contact: contact('evaluator'), signalType: 'funding_round' }), false)
  assert.equal(shouldAlert({ account: acct, contact: null, signalType: 'conference_attendance' }), false)
})

test('blocker contact never alerts', () => {
  const acct = account('no_budget')
  assert.equal(shouldAlert({ account: acct, contact: contact('blocker'), signalType: 'funding_round' }), false)
  assert.equal(shouldAlert({ account: acct, contact: contact('blocker'), signalType: 'champion_move' }), false)
})

test('evaluator alerts on budget signals only', () => {
  const acct = account('no_budget')
  const eval_ = contact('evaluator')
  assert.equal(shouldAlert({ account: acct, contact: eval_, signalType: 'funding_round' }), true)
  assert.equal(shouldAlert({ account: acct, contact: eval_, signalType: 'new_hire' }), true)
  assert.equal(shouldAlert({ account: acct, contact: eval_, signalType: 'conference_attendance' }), false)
  assert.equal(shouldAlert({ account: acct, contact: eval_, signalType: 'champion_move' }), false)
  assert.equal(shouldAlert({ account: acct, contact: eval_, signalType: 'reengagement_window' }), false)
})

test('champion always alerts on all signal types', () => {
  const acct = account('competitor_won')
  const champ = contact('champion')
  assert.equal(shouldAlert({ account: acct, contact: champ, signalType: 'conference_attendance' }), true)
  assert.equal(shouldAlert({ account: acct, contact: champ, signalType: 'new_hire' }), true)
  assert.equal(shouldAlert({ account: acct, contact: champ, signalType: 'funding_round' }), true)
  assert.equal(shouldAlert({ account: acct, contact: champ, signalType: 'champion_move' }), true)
  assert.equal(shouldAlert({ account: acct, contact: champ, signalType: 'reengagement_window' }), true)
})

test('no contact (account-level signal) alerts for non-bad-fit accounts', () => {
  assert.equal(shouldAlert({ account: account('no_budget'), contact: null, signalType: 'conference_attendance' }), true)
  assert.equal(shouldAlert({ account: account('bad_fit'), contact: null, signalType: 'conference_attendance' }), false)
})

// ─── shouldAlertForAccount (roster-level) ────────────────────────────────────

test('bad_fit account never alerts regardless of contact roster', () => {
  const acct = account('bad_fit')
  assert.equal(shouldAlertForAccount({ account: acct, contacts: [contact('champion')], signalType: 'funding_round' }), false)
  assert.equal(shouldAlertForAccount({ account: acct, contacts: [], signalType: 'funding_round' }), false)
  assert.equal(shouldAlertForAccount({ account: acct, contacts: null, signalType: 'funding_round' }), false)
})

test('all-blocker roster suppresses alert', () => {
  const acct = account('no_budget')
  const blockers = [contact('blocker'), { id: 'c-2', tag: 'blocker' }]
  assert.equal(shouldAlertForAccount({ account: acct, contacts: blockers, signalType: 'conference_attendance' }), false)
  assert.equal(shouldAlertForAccount({ account: acct, contacts: blockers, signalType: 'funding_round' }), false)
})

test('any champion in roster always alerts', () => {
  const acct = account('no_budget')
  const mixed = [
    { id: 'c-1', tag: 'blocker' },
    { id: 'c-2', tag: 'evaluator' },
    { id: 'c-3', tag: 'champion' },
  ]
  assert.equal(shouldAlertForAccount({ account: acct, contacts: mixed, signalType: 'conference_attendance' }), true)
  assert.equal(shouldAlertForAccount({ account: acct, contacts: mixed, signalType: 'reengagement_window' }), true)
})

test('champion wins even if they come after evaluators in the list (no first-contact bug)', () => {
  // Evaluator is first — the old buggy code would pick this and suppress non-budget signals
  const acct = account('bad_timing')
  const contacts = [
    { id: 'c-1', tag: 'evaluator' },
    { id: 'c-2', tag: 'champion' },
  ]
  assert.equal(shouldAlertForAccount({ account: acct, contacts, signalType: 'conference_attendance' }), true)
  assert.equal(shouldAlertForAccount({ account: acct, contacts, signalType: 'reengagement_window' }), true)
})

test('evaluator-only roster alerts on budget signals only', () => {
  const acct = account('no_budget')
  const evals = [{ id: 'c-1', tag: 'evaluator' }, { id: 'c-2', tag: 'evaluator' }]
  assert.equal(shouldAlertForAccount({ account: acct, contacts: evals, signalType: 'funding_round' }), true)
  assert.equal(shouldAlertForAccount({ account: acct, contacts: evals, signalType: 'new_hire' }), true)
  assert.equal(shouldAlertForAccount({ account: acct, contacts: evals, signalType: 'conference_attendance' }), false)
  assert.equal(shouldAlertForAccount({ account: acct, contacts: evals, signalType: 'reengagement_window' }), false)
})

test('no contacts at all passes through (account-level monitoring)', () => {
  assert.equal(shouldAlertForAccount({ account: account('no_budget'), contacts: [], signalType: 'conference_attendance' }), true)
  assert.equal(shouldAlertForAccount({ account: account('no_budget'), contacts: null, signalType: 'conference_attendance' }), true)
})

// ─── isDuplicate ──────────────────────────────────────────────────────────────

test('same signal type within 30 days is a duplicate', () => {
  const signals = [{ account_id: 'acct-1', signal_type: 'funding_round', fired_at: daysAgo(15), ignored: false }]
  assert.equal(isDuplicate(signals, 'acct-1', 'funding_round'), true)
})

test('same signal type older than 30 days is NOT a duplicate', () => {
  const signals = [{ account_id: 'acct-1', signal_type: 'funding_round', fired_at: daysAgo(31), ignored: false }]
  assert.equal(isDuplicate(signals, 'acct-1', 'funding_round'), false)
})

test('different signal type on same account is NOT a duplicate', () => {
  const signals = [{ account_id: 'acct-1', signal_type: 'funding_round', fired_at: daysAgo(5), ignored: false }]
  assert.equal(isDuplicate(signals, 'acct-1', 'conference_attendance'), false)
})

test('same signal type on different account is NOT a duplicate', () => {
  const signals = [{ account_id: 'acct-1', signal_type: 'funding_round', fired_at: daysAgo(5), ignored: false }]
  assert.equal(isDuplicate(signals, 'acct-2', 'funding_round'), false)
})

test('ignored signals do not count toward dedup — allow re-fire after ignore', () => {
  const signals = [{ account_id: 'acct-1', signal_type: 'funding_round', fired_at: daysAgo(5), ignored: true }]
  assert.equal(isDuplicate(signals, 'acct-1', 'funding_round'), false)
})

test('signal fired exactly 30 days ago does NOT count as duplicate (boundary)', () => {
  const signals = [{ account_id: 'acct-1', signal_type: 'new_hire', fired_at: daysAgo(30), ignored: false }]
  // fired_at == cutoff means it's not > cutoff, so it should not be a duplicate
  assert.equal(isDuplicate(signals, 'acct-1', 'new_hire'), false)
})

test('empty signal list is never a duplicate', () => {
  assert.equal(isDuplicate([], 'acct-1', 'funding_round'), false)
})
