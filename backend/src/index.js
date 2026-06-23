import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import cron from 'node-cron'

import accountsRouter from './routes/accounts.js'
import contactsRouter from './routes/contacts.js'
import signalsRouter from './routes/signals.js'
import settingsRouter from './routes/settings.js'
import coverageRouter from './routes/coverage.js'
import scanRouter from './routes/scan.js'
import investorProspectsRouter from './routes/investorProspects.js'
import competitorsRouter from './routes/competitors.js'
import { requireAuth } from './middleware/auth.js'
import { scanAllAccounts } from './jobs/accountScanner.js'
import log from './lib/logger.js'

const app = express()

app.use(cors())
app.use(express.json())

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/accounts', requireAuth, accountsRouter)
app.use('/api/contacts', requireAuth, contactsRouter)
app.use('/api/signals', requireAuth, signalsRouter)
app.use('/api/settings', requireAuth, settingsRouter)
app.use('/api/coverage', requireAuth, coverageRouter)
app.use('/api/scan', requireAuth, scanRouter)
app.use('/api/investor-prospects', requireAuth, investorProspectsRouter)
app.use('/api/competitors', requireAuth, competitorsRouter)

// Legacy manual trigger — kept for backwards compatibility / admin use
app.post('/api/run-signals', async (req, res) => {
  try {
    const result = await scanAllAccounts()
    res.json({ fired: result.signals_found, ...result })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/health', (_req, res) => res.json({ ok: true }))

// ─── Cron ─────────────────────────────────────────────────────────────────────
// Monday 7am UTC — full sweep of all active accounts across all 11 detectors.
// Sorted by closed_lost_at ASC (oldest deals first). Silent — no user notifications.
cron.schedule('0 7 * * 1', () => {
  const run_at = new Date().toISOString()
  log.info({ run_at }, '[cron] weekly scan started')
  scanAllAccounts({ triggeredBy: 'cron' })
    .then(({ accounts_scanned, signals_found, proxycurl_credits_used, proxycurl_skipped, errors }) => {
      log.info(
        { run_at, accounts_scanned, signals_found, proxycurl_credits_used, proxycurl_skipped, errors: errors?.length ?? 0 },
        '[cron] weekly scan complete'
      )
    })
    .catch((err) => log.error({ err: err.message }, '[cron] weekly scan failed'))
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => log.info({ port: PORT }, 'Signal backend running'))
