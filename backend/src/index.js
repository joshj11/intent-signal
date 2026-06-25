import 'dotenv/config'
import express from 'express'
import cors from 'cors'

import accountsRouter from './routes/accounts.js'
import contactsRouter from './routes/contacts.js'
import signalsRouter from './routes/signals.js'
import settingsRouter from './routes/settings.js'
import coverageRouter from './routes/coverage.js'
import scanRouter from './routes/scan.js'
import investorProspectsRouter from './routes/investorProspects.js'
import competitorsRouter from './routes/competitors.js'
import { requireAuth } from './middleware/auth.js'
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

app.get('/health', (_req, res) => res.json({ ok: true }))


const PORT = process.env.PORT || 3001
app.listen(PORT, () => log.info({ port: PORT }, 'Signal backend running'))
