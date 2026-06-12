# Signal — Intent Signal Tracker

B2B sales tool that monitors closed-lost accounts for re-engagement signals.

## Stack
- **Frontend**: React + Tailwind → Vercel
- **Backend**: Node.js + Express → Railway
- **Database**: Supabase (Postgres + Auth)
- **Alerts**: SendGrid
- **Enrichment**: Crunchbase API (free), Proxycurl (optional), Perigon (optional), Adzuna (optional)

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

# Frontend
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
| `VITE_SUPABASE_URL` | Your Supabase project URL — Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key — Settings → API → Project API keys → `anon public` |

### Backend (`backend/.env`)

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (backend only — never expose in frontend) |
| `SUPABASE_JWT_SECRET` | JWT secret for verifying auth tokens — Settings → API → JWT Settings |
| `SENDGRID_API_KEY` | SendGrid API key for alert emails |
| `SENDGRID_FROM_EMAIL` | Verified sender address |
| `ALERT_EMAILS` | Comma-separated list of rep emails to receive alerts |
| `FRONTEND_URL` | Frontend origin for CORS (default: `http://localhost:5173`) |
| `PROXYCURL_API_KEY` | Optional — enables LinkedIn monitoring (champion moves, blocker departures) |
| `PERIGON_API_KEY` | Optional — enables competitor news signals |
| `ADZUNA_APP_ID` | Optional — enables economic buyer signals |
| `ADZUNA_APP_KEY` | Optional — enables economic buyer signals |

Crunchbase API key is stored in the app's Settings screen, not in env.

## Authentication

Signal uses Supabase Auth. Users sign up with email + password and must confirm their email before signing in. All routes are login-protected.

To create your first account, run the app locally and use the sign-up form, or create a user directly in the Supabase dashboard under **Authentication → Users**.

## Database

Apply migrations from `backend/supabase/schema.sql` in the Supabase SQL editor.

## Signal sources

See [`docs/signal-sources.md`](docs/signal-sources.md) for full details on each detector, API configuration, scan cadence, and Proxycurl credit rules.
