import { Router } from 'express'
import supabase from '../lib/supabase.js'

const router = Router()

// GET /api/signals?limit=50&offset=0
router.get('/', async (req, res) => {
  const limit = parseInt(req.query.limit) || 50
  const offset = parseInt(req.query.offset) || 0

  const { data, error } = await supabase
    .from('signals')
    .select('*, accounts!inner(name, loss_reason, rep_email), contacts(name, tag)')
    .eq('accounts.user_id', req.user.id)
    .order('fired_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// POST /api/signals/:id/alert — mark signal as acknowledged
router.post('/:id/alert', async (req, res) => {
  const { data: check } = await supabase
    .from('signals')
    .select('id, accounts!inner(user_id)')
    .eq('id', req.params.id)
    .eq('accounts.user_id', req.user.id)
    .single()
  if (!check) return res.status(404).json({ error: 'Signal not found' })

  const { data, error } = await supabase
    .from('signals')
    .update({ alerted: true, alerted_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// POST /api/signals/:id/ignore
router.post('/:id/ignore', async (req, res) => {
  const { data: check } = await supabase
    .from('signals')
    .select('id, accounts!inner(user_id)')
    .eq('id', req.params.id)
    .eq('accounts.user_id', req.user.id)
    .single()
  if (!check) return res.status(404).json({ error: 'Signal not found' })

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
