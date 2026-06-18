-- migration_008: scan run history
create table if not exists scan_runs (
  id              uuid primary key default gen_random_uuid(),
  ran_at          timestamptz not null default now(),
  triggered_by    text not null default 'manual',
  accounts_scanned int not null default 0,
  signals_found   int not null default 0,
  errors_count    int not null default 0,
  skipped         jsonb not null default '[]'::jsonb
);

create index if not exists idx_scan_runs_ran_at on scan_runs(ran_at desc);
