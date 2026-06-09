# Signal — Intent Signal Tracker

B2B sales tool that monitors closed-lost accounts for re-engagement signals.

## Stack
- **Frontend**: React + Tailwind → Vercel
- **Backend**: Node.js + Express → Railway
- **Database**: Supabase (Postgres)
- **Alerts**: SendGrid
- **Enrichment**: Crunchbase API (free), Proxycurl (optional)

## Running locally

### Prerequisites
- Node.js 18+
- Supabase project (free tier)

### Setup

```bash
# Backend
cd backend
cp .env.example .env
# fill in env vars
npm install
npm run dev

# Frontend
cd frontend
cp .env.example .env
# fill in VITE_API_URL
npm install
npm run dev
```

## Environment variables

See `backend/.env.example` and `frontend/.env.example`.

## Database

Apply migrations from `backend/supabase/schema.sql` in the Supabase SQL editor.
