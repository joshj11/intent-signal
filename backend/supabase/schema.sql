-- Signal — full database schema
-- Apply this in the Supabase SQL editor

-- ─── Accounts ────────────────────────────────────────────────────────────────

create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  domain text,
  loss_reason text not null check (loss_reason in (
    'no_budget', 'bad_timing', 'no_priority', 'competitor_won', 'bad_fit'
  )),
  rep_email text,
  notes text,
  closed_lost_at date not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── Contacts ────────────────────────────────────────────────────────────────

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  name text not null,
  title text,
  email text,
  linkedin_url text,
  tag text not null check (tag in ('champion', 'evaluator', 'blocker')),
  notes text,
  last_linkedin_check date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── Signals ─────────────────────────────────────────────────────────────────

create table if not exists signals (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  signal_type text not null check (signal_type in (
    'conference_attendance',
    'new_hire',
    'funding_round',
    'champion_move',
    'reengagement_window'
  )),
  title text not null,
  detail text,
  source_url text,
  raw_data jsonb,
  fired_at timestamptz default now(),
  alerted boolean default false,
  alerted_at timestamptz,
  ignored boolean default false,
  ignored_at timestamptz,
  created_at timestamptz default now()
);

-- ─── Settings ────────────────────────────────────────────────────────────────

create table if not exists settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);

-- Seed default settings
insert into settings (key, value) values
  ('alert_emails', '[]'::jsonb),
  ('reengagement_windows', '{
    "no_budget": 180,
    "bad_timing": 90,
    "no_priority": 120,
    "competitor_won": 365
  }'::jsonb),
  ('conference_urls', '[]'::jsonb),
  ('proxycurl_enabled', 'false'::jsonb),
  ('proxycurl_api_key', 'null'::jsonb),
  ('crunchbase_api_key', 'null'::jsonb)
on conflict (key) do nothing;

-- ─── Indexes ─────────────────────────────────────────────────────────────────

create index if not exists idx_contacts_account_id on contacts(account_id);
create index if not exists idx_signals_account_id on signals(account_id);
create index if not exists idx_signals_fired_at on signals(fired_at desc);
create index if not exists idx_signals_alerted on signals(alerted);
create index if not exists idx_accounts_loss_reason on accounts(loss_reason);
create index if not exists idx_accounts_user_id on accounts(user_id);

-- ─── Updated_at trigger ───────────────────────────────────────────────────────

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger accounts_updated_at before update on accounts
  for each row execute function set_updated_at();

create trigger contacts_updated_at before update on contacts
  for each row execute function set_updated_at();
