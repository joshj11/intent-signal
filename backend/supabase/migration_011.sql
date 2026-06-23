-- Custom competitors added by users — merged with hardcoded Sisense list at query time
create table if not exists custom_competitors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

grant all on custom_competitors to authenticated, service_role;
