-- migration_006: investor_prospects table
create table if not exists investor_prospects (
  id                    uuid primary key default gen_random_uuid(),
  company_name          text not null,
  domain                text,
  crunchbase_id         text,
  has_shared_investor   boolean not null default false,
  shared_investor_names text[] not null default '{}',
  crunchbase_checked_at timestamptz,
  notes                 text,
  status                text not null default 'uncontacted'
    check (status in ('uncontacted', 'intro_requested', 'connected', 'not_relevant')),
  uploaded_at           timestamptz not null default now(),
  uploaded_by           uuid references auth.users(id)
);

create index if not exists investor_prospects_domain_idx
  on investor_prospects (lower(domain));

create index if not exists investor_prospects_shared_investor_idx
  on investor_prospects (has_shared_investor);
