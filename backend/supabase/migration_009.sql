-- migration_009: per-user account isolation
-- Each account is owned by the Supabase Auth user who created it.
-- Existing rows are left with user_id = NULL; they will be invisible to
-- all users until manually assigned in the Supabase dashboard:
--   UPDATE accounts SET user_id = '<your-auth-user-uuid>' WHERE user_id IS NULL;

alter table accounts
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists idx_accounts_user_id on accounts(user_id);
