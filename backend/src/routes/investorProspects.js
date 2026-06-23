import { Router } from 'express'
import supabase from '../lib/supabase.js'
import { enrichImportedProspects, enrichStaleProspects } from '../lib/sharedInvestorEnrich.js'
import { scrapeInvestorPortfolios } from '../scrapers/investorPortfolioScraper.js'
import log from '../lib/logger.js'

const router = Router()

router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('investor_prospects')
    .select('*')
    .eq('uploaded_by', req.user.id)
    .order('uploaded_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// POST /bulk — must come before /:id
router.post('/bulk', async (req, res) => {
  const { prospects } = req.body
  if (!Array.isArray(prospects) || !prospects.length) {
    return res.status(400).json({ error: 'prospects array required' })
  }

  const errors = []
  const valid = []
  for (const p of prospects) {
    if (!p.company_name?.trim()) { errors.push(`Skipped row: missing company_name`); continue }
    valid.push({ ...p, company_name: p.company_name.trim() })
  }

  const { data: existing } = await supabase.from('investor_prospects').select('company_name, domain').eq('uploaded_by', req.user.id)
  const existingNames = new Set((existing || []).map((e) => e.company_name.toLowerCase().trim()))
  const existingDomains = new Set((existing || []).map((e) => e.domain).filter(Boolean).map((d) => d.toLowerCase().trim()))

  const toInsert = []
  let skippedDuplicates = 0
  for (const p of valid) {
    const nameKey = p.company_name.toLowerCase().trim()
    const domainKey = p.domain?.toLowerCase().trim()
    if (existingNames.has(nameKey) || (domainKey && existingDomains.has(domainKey))) {
      skippedDuplicates++
      continue
    }
    toInsert.push({ company_name: p.company_name, domain: p.domain || null, notes: p.notes || null, uploaded_by: req.user.id })
  }

  if (!toInsert.length) {
    return res.json({ total_rows: prospects.length, inserted: 0, skipped_duplicates: skippedDuplicates, shared_investors_found: 0, errors })
  }

  const { data, error } = await supabase.from('investor_prospects').insert(toInsert).select()
  if (error) return res.status(500).json({ error: error.message })

  enrichImportedProspects(data).catch((err) =>
    log.warn({ err: err.message }, '[investor-prospects] bulk enrichment failed')
  )

  res.json({ total_rows: prospects.length, inserted: data.length, skipped_duplicates: skippedDuplicates, shared_investors_found: 0, errors })
})

// POST /recheck — must come before /:id
router.post('/recheck', async (req, res) => {
  try {
    const result = await enrichStaleProspects()
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /refresh-portfolio — re-scrape investor portfolio pages and rebuild cache
router.post('/refresh-portfolio', async (req, res) => {
  try {
    const result = await scrapeInvestorPortfolios()
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', async (req, res) => {
  const { company_name, domain, notes } = req.body
  if (!company_name?.trim()) return res.status(400).json({ error: 'company_name is required' })

  const { data, error } = await supabase
    .from('investor_prospects')
    .insert({ company_name: company_name.trim(), domain: domain || null, notes: notes || null, uploaded_by: req.user.id })
    .select()
    .single()
  if (error) return res.status(500).json({ error: error.message })

  enrichImportedProspects([data]).catch((err) =>
    log.warn({ err: err.message }, '[investor-prospects] enrichment failed')
  )

  res.status(201).json(data)
})

router.patch('/:id', async (req, res) => {
  const allowed = ['status', 'notes', 'company_name', 'domain']
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)))
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'no valid fields' })

  const { data, error } = await supabase
    .from('investor_prospects')
    .update(updates)
    .eq('id', req.params.id)
    .eq('uploaded_by', req.user.id)
    .select()
    .single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.delete('/:id', async (req, res) => {
  const { error } = await supabase
    .from('investor_prospects')
    .delete()
    .eq('id', req.params.id)
    .eq('uploaded_by', req.user.id)
  if (error) return res.status(500).json({ error: error.message })
  res.status(204).send()
})

export default router
