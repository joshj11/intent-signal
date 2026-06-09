-- Migration 002 — new signal types, detector_state table, accounts.competitor field
-- Run in Supabase SQL Editor

-- Add economic_buyer to the contacts tag constraint
alter table contacts drop constraint if exists contacts_tag_check;
alter table contacts add constraint contacts_tag_check
  check (tag is null or tag in ('champion', 'economic_buyer', 'evaluator', 'blocker'));

-- competitor field on accounts (used by competitor_bad_news and competitor_sunset detectors)
alter table accounts add column if not exists competitor text;

-- custom careers page URL — overrides auto-discovery in the careers scraper
alter table accounts add column if not exists careers_url text;

-- status + source for prospect accounts auto-created by champion_new_company detector
alter table accounts
  add column if not exists status text default 'active'
    check (status is null or status in ('active', 'prospect', 'churned'));
alter table accounts add column if not exists source text;

-- Expand signal_type check constraint to include all 7 new types
alter table signals drop constraint if exists signals_signal_type_check;
alter table signals add constraint signals_signal_type_check
  check (signal_type in (
    'conference_attendance',
    'new_hire',
    'funding_round',
    'champion_move',
    'reengagement_window',
    'competitor_bad_news',
    'blocker_departed',
    'champion_new_company',
    'new_economic_buyer',
    'ma_activity',
    'ipo_filing',
    'competitor_sunset'
  ));

-- detector_state: persists per-detector, per-entity state between runs
-- (seen article URLs, last-known employer, seen job IDs, filing accession numbers, etc.)
create table if not exists detector_state (
  id            uuid primary key default gen_random_uuid(),
  detector_name text not null,
  entity_id     text not null,
  state         jsonb not null default '{}',
  checked_at    timestamptz default now(),
  unique (detector_name, entity_id)
);

create index if not exists idx_detector_state_lookup
  on detector_state (detector_name, entity_id);
