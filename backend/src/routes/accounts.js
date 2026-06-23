import { Router } from 'express'
import supabase from '../lib/supabase.js'
import { scanAccount } from '../jobs/accountScanner.js'
import { enrichImportedAccounts } from '../lib/sharedInvestorEnrich.js'
import log from '../lib/logger.js'

const router = Router()

// GET /api/accounts
router.get('/', async (req, res) => {
  const userId = req.user.id

  const [accountsRes, signalsRes] = await Promise.all([
    supabase
      .from('accounts')
      .select('*, contacts(id, name, tag)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('signals')
      .select('account_id, fired_at')
      .order('fired_at', { ascending: false }),
  ])

  if (accountsRes.error) return res.status(500).json({ error: accountsRes.error.message })

  // Build last_signal_at per account (signals already ordered desc, first match wins)
  const lastSignalMap = {}
  for (const sig of signalsRes.data || []) {
    if (!lastSignalMap[sig.account_id]) lastSignalMap[sig.account_id] = sig.fired_at
  }

  const accounts = accountsRes.data.map((a) => ({
    ...a,
    last_signal_at: lastSignalMap[a.id] || null,
  }))

  res.json(accounts)
})

// GET /api/accounts/:id
router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('accounts')
    .select('*, contacts(*)')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single()

  if (error) return res.status(404).json({ error: error.message })
  res.json(data)
})

// POST /api/accounts/bulk
router.post('/bulk', async (req, res) => {
  const { accounts } = req.body
  if (!Array.isArray(accounts) || !accounts.length) {
    return res.status(400).json({ error: 'accounts array is required' })
  }

  // Dedup against this user's existing accounts
  const { data: existing } = await supabase.from('accounts').select('name').eq('user_id', req.user.id)
  const existingNames = new Set((existing || []).map((a) => a.name.toLowerCase().trim()))

  const toInsert = accounts
    .filter((a) => !existingNames.has(a.name.toLowerCase().trim()))
    .map((a) => ({ ...a, user_id: req.user.id }))

  if (!toInsert.length) {
    return res.json({ inserted: 0, skipped: accounts.length })
  }

  const { data, error } = await supabase.from('accounts').insert(toInsert).select()
  if (error) return res.status(500).json({ error: error.message })

  // Enrich in background — never blocks the import response
  enrichImportedAccounts(data).catch((err) =>
    log.warn({ err: err.message }, '[bulk] shared investor enrichment failed')
  )

  res.json({ inserted: data.length, skipped: accounts.length - data.length })
})

// POST /api/accounts
router.post('/', async (req, res) => {
  const { name, domain, account_type = 'closed_lost', loss_reason, rep_email, notes, closed_lost_at } = req.body

  if (!name) return res.status(400).json({ error: 'name is required' })
  if (account_type === 'closed_lost' && (!loss_reason || !closed_lost_at)) {
    return res.status(400).json({ error: 'loss_reason and closed_lost_at are required for closed-lost accounts' })
  }

  const { data, error } = await supabase
    .from('accounts')
    .insert({ user_id: req.user.id, name, domain, account_type, loss_reason: loss_reason || null, rep_email, notes, closed_lost_at: closed_lost_at || null })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })

  // Enrich in background — never blocks the response
  enrichImportedAccounts([data]).catch((err) =>
    log.warn({ err: err.message }, '[accounts] shared investor enrichment failed')
  )

  res.status(201).json(data)
})

// PATCH /api/accounts/bulk — must be before /:id
router.patch('/bulk', async (req, res) => {
  const { ids, updates } = req.body
  if (!Array.isArray(ids) || !ids.length) {
    return res.status(400).json({ error: 'ids array is required' })
  }

  const allowed = ['loss_reason', 'closed_lost_at', 'account_type', 'rep_email']
  const safeUpdates = Object.fromEntries(
    Object.entries(updates || {}).filter(([k]) => allowed.includes(k))
  )

  if (!Object.keys(safeUpdates).length) {
    return res.status(400).json({ error: 'no valid update fields provided' })
  }

  const { error } = await supabase
    .from('accounts')
    .update(safeUpdates)
    .in('id', ids)
    .eq('user_id', req.user.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ updated: ids.length })
})

// DELETE /api/accounts/bulk — must be before /:id
router.delete('/bulk', async (req, res) => {
  const { ids } = req.body
  if (!Array.isArray(ids) || !ids.length) {
    return res.status(400).json({ error: 'ids array is required' })
  }

  const { error } = await supabase
    .from('accounts')
    .delete()
    .in('id', ids)
    .eq('user_id', req.user.id)
  if (error) return res.status(500).json({ error: error.message })
  res.status(204).send()
})

// PATCH /api/accounts/:id
router.patch('/:id', async (req, res) => {
  const allowed = ['name', 'domain', 'account_type', 'loss_reason', 'rep_email', 'notes', 'closed_lost_at', 'competitor', 'careers_url']
  const updates = Object.fromEntries(
    Object.entries(req.body).filter(([k]) => allowed.includes(k))
  )

  const { data, error } = await supabase
    .from('accounts')
    .update(updates)
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// POST /api/accounts/:id/scan — run all 11 detectors for a single account
router.post('/:id/scan', async (req, res) => {
  // Verify ownership before scanning
  const { data: account, error: ownerErr } = await supabase
    .from('accounts')
    .select('id')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single()

  if (ownerErr || !account) return res.status(404).json({ error: 'Account not found' })

  const manualCap = parseInt(process.env.PROXYCURL_MANUAL_CAP ?? '10', 10)
  const proxyCreditTracker = { used: 0, skipped: 0, limit: manualCap }
  try {
    const result = await scanAccount(req.params.id, { proxyCreditTracker })
    res.json({
      signals_found: result.signals_found,
      signal_types: result.signal_types,
      duration_ms: result.duration_ms,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/accounts/:id
router.delete('/:id', async (req, res) => {
  const { error } = await supabase
    .from('accounts')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
  if (error) return res.status(500).json({ error: error.message })
  res.status(204).send()
})

export default router
