# Signal — Intent Signal Tracker

B2B sales tool that monitors closed-lost accounts for re-engagement signals. Tracks funding rounds, hiring surges, champion moves, competitor bad news, IPO filings, and more — then fires email alerts to reps.

## Stack

- **Frontend**: React + Tailwind → Vercel
- **Backend**: Node.js + Express → Render
- **Database**: Supabase (Postgres + Auth)
- **Alerts**: Nodemailer (via SendGrid SMTP)
- **Enrichment**: Crunchbase API (configured in-app), Proxycurl (optional), Perigon (optional), Adzuna (optional)

## Pages

| Page | Route | Description |
|------|-------|-------------|
| Signal Feed | `/signals` | All signals across accounts, filterable by type |
| Accounts | `/accounts` | List of tracked closed-lost accounts |
| Account Detail | `/accounts/:id` | Signals, contacts, and scan history for one account |
| Investor Prospects | `/investor-prospects` | Accounts with shared investors — warm intro leads |
| Settings | `/settings` | API keys, alert config, conference list |

## Running locally

### Prerequisites

- Node.js 18+
- Supabase project (free tier)

### Setup

```bash
# Backend
cd backend
cp .env.example .env
# fill in env vars (see below)
npm install
npm run dev

# Frontend (separate terminal)
cd frontend
cp .env.example .env
# fill in env vars (see below)
npm install
npm run dev
```

## Environment variables

### Frontend (`frontend/.env`)

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend URL (default: `http://localhost:3001`) |
| `VITE_SUPABASE_URL` | Supabase project URL — Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key — Settings → API → Project API keys → `anon public` |

### Backend (`backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Yes | Service role key (never expose in frontend) |
| `SUPABASE_JWT_SECRET` | Yes | JWT secret — Settings → API → JWT Settings |
| `SENDGRID_API_KEY` | Yes | SendGrid API key for alert emails |
| `SENDGRID_FROM_EMAIL` | Yes | Verified sender address |
| `ALERT_EMAILS` | Yes | Comma-separated rep emails to receive alerts |
| `FRONTEND_URL` | Yes | Frontend origin for CORS (default: `http://localhost:5173`) |
| `CRUNCHBASE_API_KEY` | No | Crunchbase API key — alternative to configuring it in the Settings screen |
| `OUR_CRUNCHBASE_PERMALINK` | No | Your company's Crunchbase permalink — used for shared investor enrichment at import |
| `PROXYCURL_API_KEY` | No | Enables LinkedIn monitoring (champion moves, blocker departures) |
| `PROXYCURL_WEEKLY_CAP` | No | Max Proxycurl credits per weekly scan (default: `50`) |
| `PROXYCURL_MANUAL_CAP` | No | Max Proxycurl credits per manual scan (default: `10`) |
| `PERIGON_API_KEY` | No | Enables competitor news signals |
| `ADZUNA_APP_ID` | No | Enables economic buyer signals (job postings) |
| `ADZUNA_APP_KEY` | No | Enables economic buyer signals |
| `ADZUNA_MARKET` | No | Adzuna job market country code (default: `gb`) |

The **Crunchbase API key** can be configured either in the app's Settings screen (stored in the `settings` DB table) or via the `CRUNCHBASE_API_KEY` env var. The Settings screen takes precedence.

## Authentication

Signal uses Supabase Auth (email + password). Users must confirm their email before signing in. All routes are login-protected.

To create your first account: sign up via the app's login page, or create a user directly in the Supabase dashboard under **Authentication → Users**.

## Database

Apply migrations from `backend/supabase/schema.sql` in the Supabase SQL editor.

## Signal sources

11 detectors run on a weekly cron (Monday 07:00 UTC) and can also be triggered manually per-account or across all accounts.

| Signal | Source |
|--------|--------|
| `funding_round` | Crunchbase API |
| `ma_activity` | Crunchbase API |
| `new_hire` | Account careers page (scraped) |
| `conference_attendance` | Conference attendee lists (scraped) |
| `champion_move` | Proxycurl LinkedIn API |
| `champion_new_company` | Proxycurl LinkedIn API |
| `blocker_departed` | Proxycurl LinkedIn API |
| `competitor_bad_news` | Perigon News API |
| `competitor_sunset` | Perigon News API + RSS |
| `new_economic_buyer` | Adzuna Jobs API |
| `ipo_filing` | SEC EDGAR (free) |

See [`docs/signal-sources.md`](docs/signal-sources.md) for API details, scan execution model, Proxycurl credit rules, and deduplication logic.

## Scan API

| Endpoint | Description |
|----------|-------------|
| `POST /api/accounts/:id/scan` | Scan a single account |
| `POST /api/scan/all` | Scan all active accounts (requires `{ "confirm": true }` body) |
