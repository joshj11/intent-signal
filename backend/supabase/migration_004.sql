-- Accounts: new columns for RSS feed, Crunchbase permalink
alter table accounts add column if not exists competitor_rss_url text;
alter table accounts add column if not exists crunchbase_id text;

-- Contacts: Proxycurl tracking fields
alter table contacts add column if not exists employer_updated_at timestamptz;
alter table contacts add column if not exists proxycurl_scan_pending boolean not null default false;

-- Conferences table (used by conference_attendance detector)
create table if not exists conferences (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  url          text not null,
  year         int  not null,
  scrape_selector text,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
