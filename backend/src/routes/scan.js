import { Router } from 'express'
import log from '../lib/logger.js'
import { scanAccount, scanAllAccounts } from '../jobs/accountScanner.js'

const router = Router()

// POST /api/scan/all — manual full scan
// Requires { confirm: true } in body as a safety gate against accidental calls.
router.post('/all', async (req, res) => {
  if (req.body?.confirm !== true) {
    return res.status(400).json({ error: 'Missing confirmation. Pass { "confirm": true } in the request body.' })
  }

  try {
    const result = await scanAllAccounts()
    log.info(
      { accounts_scanned: result.accounts_scanned, signals_found: result.signals_found,
        proxycurl_credits_used: result.proxycurl_credits_used, proxycurl_skipped: result.proxycurl_skipped },
      '[scan] scan-all complete'
    )
    res.json({
      accounts_scanned: result.accounts_scanned,
      signals_found: result.signals_found,
      proxycurl_credits_used: result.proxycurl_credits_used,
      proxycurl_skipped: result.proxycurl_skipped,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
