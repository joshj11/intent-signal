-- Signal notes: free-text field for logging what you did when acknowledging
alter table signals add column if not exists notes text;

-- Account last contacted date
alter table accounts add column if not exists last_contacted_at date;
