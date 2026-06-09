-- Add scan history timestamp to accounts
alter table accounts add column if not exists last_scanned_at timestamptz;
