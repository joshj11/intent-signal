import { Router } from 'express'
import supabase from '../lib/supabase.js'
import { sendAlertEmail } from '../lib/mailer.js'

const router = Router()

// GET /api/signals?limit=50&offset=0
router.get('/', async (req, res) => {
  const limit = parseInt(req.query.limit) || 50
  const offset = parseInt(req.query.offset) || 0

  const { data, error } = await supabase
    .from('signals')
    .select('*, accounts(name, loss_reason, rep_email), contacts(name, tag)')
    .order('fired_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// POST /api/signals/:id/alert  — manually send alert email
router.post('/:id/alert', async (req, res) => {
  const { data: signal, error } = await supabase
    .from('signals')
    .select('*, accounts(*), contacts(*)')
    .eq('id', req.params.id)
    .single()

  if (error) return res.status(404).json({ error: error.message })
  if (signal.alerted) return res.status(400).json({ error: 'Already alerted' })

  const { data: settingsRow } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'alert_emails')
    .single()

  const to = settingsRow?.value?.length
    ? settingsRow.value
    : signal.accounts?.rep_email
    ? [signal.accounts.rep_email]
    : null

  if (!to) return res.status(400).json({ error: 'No alert email configured' })

  await sendAlertEmail({
    to,
    signal,
    account: signal.accounts,
    contact: signal.contacts,
  })

  const { data: updated } = await supabase
    .from('signals')
    .update({ alerted: true, alerted_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select()
    .single()

  res.json(updated)
})

// POST /api/signals/:id/ignore
router.post('/:id/ignore', async (req, res) => {
  const { data, error } = await supabase
    .from('signals')
    .update({ ignored: true, ignored_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

export default router
