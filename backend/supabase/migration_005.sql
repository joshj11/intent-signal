-- migration_005: shared investor enrichment columns on accounts
-- These are set once at import time, not updated by recurring scans.

alter table accounts
  add column if not exists has_shared_investor boolean not null default false,
  add column if not exists shared_investor_names text[] not null default '{}';
