import { Router } from 'express'
import supabase from '../lib/supabase.js'
import { SISENSE_COMPETITORS } from '../lib/sisenseCompetitors.js'

const router = Router()

// GET /api/competitors — hardcoded list merged with any user-added ones
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('custom_competitors')
    .select('name')
    .order('name')
  if (error) return res.status(500).json({ error: error.message })

  const custom = (data || []).map((r) => r.name)
  const all = [...new Set([...SISENSE_COMPETITORS, ...custom])].sort()
  res.json(all)
})

// POST /api/competitors — add a custom competitor (ignored if already exists)
router.post('/', async (req, res) => {
  const name = req.body.name?.trim()
  if (!name) return res.status(400).json({ error: 'name is required' })

  // Don't insert if it's already in the hardcoded list
  if (SISENSE_COMPETITORS.map((c) => c.toLowerCase()).includes(name.toLowerCase())) {
    return res.json({ name, added: false, reason: 'already in default list' })
  }

  const { error } = await supabase
    .from('custom_competitors')
    .upsert({ name }, { onConflict: 'name' })
  if (error) return res.status(500).json({ error: error.message })

  res.status(201).json({ name, added: true })
})

export default router
