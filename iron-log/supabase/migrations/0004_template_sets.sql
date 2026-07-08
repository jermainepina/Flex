-- Phase 7: templates remember how many sets each exercise should start with;
-- starting a workout from a template pre-fills that many empty set rows.
-- Run in the Supabase SQL editor (after 0003).

alter table public.template_exercises
  add column target_sets int not null default 1 check (target_sets between 1 and 20);
