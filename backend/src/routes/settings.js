import { Router } from 'express'
import supabase from '../lib/supabase.js'

const router = Router()

// GET /api/settings — returns all settings as a flat object.
// API key values are masked: returns true if set, null if not.
router.get('/', async (req, res) => {
  const { data, error } = await supabase.from('settings').select('*')
  if (error) return res.status(500).json({ error: error.message })

  const SECRET_SUFFIXES = ['_api_key', '_app_key', '_app_id']
  const flat = Object.fromEntries(data.map((row) => {
    const isSecret = SECRET_SUFFIXES.some((s) => row.key.endsWith(s))
    const value = isSecret ? (row.value && row.value !== 'null' ? true : null) : row.value
    return [row.key, value]
  }))
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
