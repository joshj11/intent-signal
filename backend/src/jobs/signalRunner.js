import { scrapeConferences } from '../scrapers/conferenceScraper.js'
import { scrapeCareers } from '../scrapers/careersScraper.js'
import { checkFundingRounds } from '../scrapers/crunchbaseScraper.js'
import { checkChampionMoves } from '../scrapers/linkedinScraper.js'
import { checkReengagementWindows } from '../scrapers/reengagementChecker.js'
import { checkCompetitorBadNews } from '../scrapers/competitorBadNews.js'
import { checkCompetitorSunset } from '../scrapers/competitorSunset.js'
import { checkNewEconomicBuyer } from '../scrapers/newEconomicBuyer.js'
import { checkIpoFilings } from '../scrapers/ipoFiling.js'
import { triggerAlert } from '../lib/triggerAlert.js'

// autoAlertSignal is now triggerAlert — kept as a local alias for compatibility
const autoAlertSignal = triggerAlert

export async function runAllSignals() {
  console.log('[signal-runner] Starting signal scan...')

  const results = await Promise.allSettled([
    scrapeConferences(),
    scrapeCareers(),
    checkFundingRounds(),
    checkChampionMoves(),
    checkReengagementWindows(),
    // Daily detectors added in migration_002
    checkCompetitorBadNews(),
    checkCompetitorSunset(),
    checkNewEconomicBuyer(),
    checkIpoFilings(),
  ])

  const allFired = results
    .filter((r) => r.status === 'fulfilled')
    .flatMap((r) => r.value || [])

  console.log(`[signal-runner] ${allFired.length} new signal(s) fired`)

  // Auto-alert all new signals
  for (const signal of allFired) {
    await autoAlertSignal(signal)
  }

  return allFired
}
