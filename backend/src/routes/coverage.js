import { Router } from 'express'
import supabase from '../lib/supabase.js'

const router = Router()

// GET /api/coverage/careers
// Returns accounts that have no working careers page.
// Two groups: no_domain (never tried), not_found (tried, failed).
// Accounts with careers_url set are excluded — they're already handled.
router.get('/careers', async (req, res) => {
  const [accountsRes, statesRes] = await Promise.all([
    supabase
      .from('accounts')
      .select('id, name, domain, careers_url, account_type, loss_reason')
      .order('name'),
    supabase
      .from('detector_state')
      .select('entity_id, state')
      .eq('detector_name', 'careers'),
  ])

  if (accountsRes.error) return res.status(500).json({ error: accountsRes.error.message })

  const stateMap = {}
  for (const s of statesRes.data || []) stateMap[s.entity_id] = s.state

  const no_domain = []
  const not_found = []

  for (const account of accountsRes.data || []) {
    if (account.loss_reason === 'bad_fit') continue
    if (account.careers_url) continue  // already has a custom URL

    if (!account.domain) {
      no_domain.push(account)
      continue
    }

    const state = stateMap[account.id]
    if (state && state.found === false) {
      not_found.push({ ...account, tried_at: state.tried_at })
    }
  }

  res.json({ no_domain, not_found })
})

export default router
