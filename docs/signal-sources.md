# Signal Sources

## Detectors

| Signal | File | Source | Cadence |
|--------|------|--------|---------|
| `conference_attendance` | `conferenceScraper.js` | `conferences` DB table (scraped HTML) | Weekly auto + manual |
| `new_hire` | `careersScraper.js` | `accounts.careers_url` (scraped HTML) | Weekly auto + manual |
| `funding_round` | `crunchbaseScraper.js` | Crunchbase Basic API v4 | Weekly auto + manual |
| `champion_move` | `linkedinScraper.js` | Proxycurl LinkedIn API | Weekly auto + manual |
| `champion_new_company` | `championNewCompany.js` | Proxycurl LinkedIn API | Weekly auto + manual |
| `blocker_departed` | `blockerDeparted.js` | Proxycurl LinkedIn API | Weekly auto + manual |
| `competitor_bad_news` | `competitorBadNews.js` | Perigon News API | Weekly auto + manual |
| `competitor_sunset` | `competitorSunset.js` | Perigon News API + RSS feed | Weekly auto + manual |
| `new_economic_buyer` | `newEconomicBuyer.js` | Adzuna Jobs API | Weekly auto + manual |
| `ma_activity` | `maActivity.js` | Crunchbase Basic API v4 | Weekly auto + manual |
| `ipo_filing` | `ipoFiling.js` | SEC EDGAR full-text search (free) | Weekly auto + manual |

---

## API Details

### Perigon (competitor_bad_news, competitor_sunset)
- Base URL: `https://api.goperigon.com/v1/all`
- Auth: `x-api-key` header
- Env: `PERIGON_API_KEY`
- Parameters: `q`, `category=Business,Technology`, `from`, `sortBy=date`, `size=10`
- Replaces: NewsAPI (`NEWS_API_KEY` no longer used)

### Crunchbase Basic API (funding_round, ma_activity)
- Base URL: `https://api.crunchbase.com/api/v4`
- Auth: `user_key` query param
- Env: `CRUNCHBASE_KEY` (stored in settings table under `crunchbase_api_key`)
- Permalink caching: resolved once via domain search, cached in `accounts.crunchbase_id`
- Entity endpoint: `GET /entities/organizations/{permalink}?field_ids=...`
- Acquisitions card: `GET /entities/organizations/{permalink}?card_ids=acquiree_acquisitions`

### Proxycurl (champion_move, champion_new_company, blocker_departed)
- Endpoint: `https://nubela.co/proxycurl/api/v2/linkedin`
- Auth: `Authorization: Bearer {PROXYCURL_KEY}` header
- Env: `PROXYCURL_KEY`
- Query: `{ url: linkedin_url, use_cache: "if-recent" }` — returns cached data if < 29 days old (free)
- Credit tracking: `contacts.employer_updated_at` (updated after each call)
- Pending flag: `contacts.proxycurl_scan_pending` set to `true` when skipped due to cap

### Adzuna (new_economic_buyer)
- Base URL: `https://api.adzuna.com/v1/api/jobs/{ADZUNA_MARKET}/search/1`
- Env: `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, `ADZUNA_MARKET` (default: `gb`)
- Parameters: `what_or`, `title_only=1`, `company`, `results_per_page=5`, `sort_by=date`
- Deduplication: Adzuna job `id` stored in `detector_state`

### SEC EDGAR (ipo_filing)
- Endpoint: `https://efts.sec.gov/LATEST/search-index`
- Auth: none (free public API)
- Parameters: `q="COMPANY NAME"`, `forms=S-1`, `dateRange=custom`, `startdt`, `enddt`
- Rate limit: 1s delay between requests in batch mode
- Deduplication: `accession_no` stored in `detector_state`

### Conference attendance
- Source: `conferences` DB table
- Columns: `id`, `name`, `url`, `year`, `scrape_selector`, `active`
- Scrape cadence: at most once per calendar day per conference (cached in `detector_state`)
- Matching: `account.name` (sponsor) or `contact.name` (attendee) found in scraped text

### Careers / Engineering hiring
- Source: `accounts.careers_url` if set, otherwise auto-discovered from domain
- URL patterns tried: `/careers`, `/jobs`, `jobs.{domain}`, `/about/careers`
- Selectors: `.jobs`, `.careers`, `.positions`, `#jobs`, `[data-job]`, `main` (fallback: body)
- Fire condition: `matched_count` increased vs previous scan (stored in `detector_state`)

---

## Scan Execution Model

### Weekly auto-scan
- Schedule: Monday 07:00 UTC (`0 7 * * 1`)
- Scope: all accounts where `status = 'active'`, ordered by `closed_lost_at ASC`
- Proxycurl cap: `PROXYCURL_WEEKLY_CAP` (default 50) shared across entire run
- Silent: no user notifications; logs summary via pino on completion

### Manual scan — single account
- Endpoint: `POST /api/accounts/:id/scan`
- Proxycurl cap: `PROXYCURL_MANUAL_CAP` (default 10) per scan
- Returns: `{ signals_found, signal_types, duration_ms }`

### Manual scan — all accounts
- Endpoint: `POST /api/scan/all`
- Body: `{ "confirm": true }` required (safety gate)
- Same logic as weekly cron
- Returns: `{ accounts_scanned, signals_found, proxycurl_credits_used, proxycurl_skipped }`

---

## Proxycurl Credit Rules

| Rule | Detail |
|------|--------|
| Staleness gate (< 90d since lost) | Skip contact if checked within **7 days** |
| Staleness gate (90d–1yr since lost) | Skip contact if checked within **14 days** |
| Staleness gate (> 1yr since lost) | Skip contact if checked within **30 days** |
| Priority order | Champions (move + new company) processed before Blockers |
| Cap enforcement | Contacts skipped due to cap get `proxycurl_scan_pending = true` |
| use_cache | `"if-recent"` param — Proxycurl returns cached data < 29d old at no credit cost |

---

## Environment Variables

| Variable | Used by | Default |
|----------|---------|---------|
| `PERIGON_API_KEY` | competitor detectors | — |
| `PROXYCURL_KEY` | Proxycurl detectors | — |
| `PROXYCURL_WEEKLY_CAP` | scanAllAccounts | `50` |
| `PROXYCURL_MANUAL_CAP` | per-account scan | `10` |
| `ADZUNA_APP_ID` | new_economic_buyer | — |
| `ADZUNA_APP_KEY` | new_economic_buyer | — |
| `ADZUNA_MARKET` | new_economic_buyer | `gb` |

Crunchbase API key is stored in the `settings` table (key: `crunchbase_api_key`), not in env.
