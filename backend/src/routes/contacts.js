import { Router } from 'express'
import supabase from '../lib/supabase.js'

const router = Router()

// GET /api/contacts?account_id=...
router.get('/', async (req, res) => {
  let query = supabase.from('contacts').select('*, accounts(name, loss_reason)')

  if (req.query.account_id) {
    query = query.eq('account_id', req.query.account_id)
  }

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// POST /api/contacts
router.post('/', async (req, res) => {
  const { account_id, name, title, email, linkedin_url, tag, notes } = req.body

  if (!account_id || !name || !tag) {
    return res.status(400).json({ error: 'account_id, name, and tag are required' })
  }

  const { data, error } = await supabase
    .from('contacts')
    .insert({ account_id, name, title, email, linkedin_url, tag, notes })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(data)
})

// PATCH /api/contacts/:id
router.patch('/:id', async (req, res) => {
  const allowed = ['name', 'title', 'email', 'linkedin_url', 'tag', 'notes', 'last_linkedin_check']
  const updates = Object.fromEntries(
    Object.entries(req.body).filter(([k]) => allowed.includes(k))
  )

  const { data, error } = await supabase
    .from('contacts')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// DELETE /api/contacts/:id
router.delete('/:id', async (req, res) => {
  const { error } = await supabase.from('contacts').delete().eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  res.status(204).send()
})

export default router
