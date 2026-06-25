import { Router } from 'express'
import supabase from '../lib/supabase.js'
import log from '../lib/logger.js'
import { scanAccount, scanAllAccounts } from '../jobs/accountScanner.js'

const router = Router()

let scanInProgress = false

// GET /api/scan/runs — recent scan history
router.get('/runs', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit ?? '10', 10), 50)
  const { data, error } = await supabase
    .from('scan_runs')
    .select('*')
    .order('ran_at', { ascending: false })
    .limit(limit)
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// POST /api/scan/all — manual full scan
router.post('/all', async (req, res) => {
  if (req.body?.confirm !== true) {
    return res.status(400).json({ error: 'Missing confirmation. Pass { "confirm": true } in the request body.' })
  }

  if (scanInProgress) {
    return res.status(409).json({ error: 'A scan is already in progress. Please wait for it to finish.' })
  }

  scanInProgress = true
  try {
    const accountType = ['closed_lost', 'territory'].includes(req.body?.account_type) ? req.body.account_type : 'all'
    const result = await scanAllAccounts({ triggeredBy: 'manual', accountType })
    log.info(
      { accounts_scanned: result.accounts_scanned, signals_found: result.signals_found,
        proxycurl_credits_used: result.proxycurl_credits_used, proxycurl_skipped: result.proxycurl_skipped,
        skipped: result.skipped?.map((s) => s.label) },
      '[scan] scan-all complete'
    )
    res.json({
      accounts_scanned: result.accounts_scanned,
      signals_found: result.signals_found,
      proxycurl_credits_used: result.proxycurl_credits_used,
      proxycurl_skipped: result.proxycurl_skipped,
      skipped: result.skipped ?? [],
      errors: result.errors ?? [],
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  } finally {
    scanInProgress = false
  }
})

// POST /api/scan/:id — scan a single account
router.post('/:id', async (req, res) => {
  try {
    const result = await scanAccount(req.params.id)
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
