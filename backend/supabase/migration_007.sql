-- migration_007: add Perigon and Adzuna API key settings
insert into settings (key, value) values
  ('perigon_api_key', 'null'::jsonb),
  ('adzuna_app_id',   'null'::jsonb),
  ('adzuna_app_key',  'null'::jsonb)
on conflict (key) do nothing;
