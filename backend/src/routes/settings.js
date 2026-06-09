import { Router } from 'express'
import supabase from '../lib/supabase.js'

const router = Router()

// GET /api/settings — returns all settings as a flat object
router.get('/', async (req, res) => {
  const { data, error } = await supabase.from('settings').select('*')
  if (error) return res.status(500).json({ error: error.message })

  const flat = Object.fromEntries(data.map((row) => [row.key, row.value]))
  res.json(flat)
})

// PATCH /api/settings/:key
router.patch('/:key', async (req, res) => {
  const { value } = req.body
  if (value === undefined) return res.status(400).json({ error: 'value is required' })

  const { data, error } = await supabase
    .from('settings')
    .upsert({ key: req.params.key, value, updated_at: new Date().toISOString() })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

export default router
