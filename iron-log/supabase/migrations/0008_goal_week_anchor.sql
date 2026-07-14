-- Weekly goals can measure the calendar week (Monday start) or a rolling
-- 7-day window from creation. Non-weekly goals ignore the column. Part of
-- the shift to one-shot goal windows anchored at created_at (missed goals
-- auto-delete client-side; no schema needed for that).
-- Run in the Supabase SQL editor (after 0007).

alter table public.goals
  add column week_anchor text not null default 'monday'
  check (week_anchor in ('monday', 'rolling'));
