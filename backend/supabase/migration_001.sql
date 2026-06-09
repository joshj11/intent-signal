-- Migration 001 — account types, updated loss reasons, nullable fields
-- Run in Supabase SQL Editor

-- Add account_type to accounts
alter table accounts
  add column if not exists account_type text not null default 'closed_lost'
  check (account_type in ('closed_lost', 'territory'));

-- Make loss_reason nullable (territory accounts don't have one)
alter table accounts alter column loss_reason drop not null;

-- Make closed_lost_at nullable (territory accounts don't have one)
alter table accounts alter column closed_lost_at drop not null;

-- Update loss_reason constraint: bad_timing → wrong_timing, add no_resources
alter table accounts drop constraint if exists accounts_loss_reason_check;
alter table accounts add constraint accounts_loss_reason_check
  check (loss_reason is null or loss_reason in (
    'no_budget', 'no_priority', 'no_resources', 'wrong_timing', 'competitor_won', 'bad_fit'
  ));

-- Rename bad_timing to wrong_timing on any existing rows
update accounts set loss_reason = 'wrong_timing' where loss_reason = 'bad_timing';

-- Make contact tag nullable (territory account contacts don't require a tag)
alter table contacts alter column tag drop not null;
alter table contacts drop constraint if exists contacts_tag_check;
alter table contacts add constraint contacts_tag_check
  check (tag is null or tag in ('champion', 'evaluator', 'blocker'));
