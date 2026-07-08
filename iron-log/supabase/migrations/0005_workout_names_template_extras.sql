-- Post-phase-7 refinements. Run in the Supabase SQL editor (after 0004).
--
-- 1. Workouts get a free-text name (replaces the type dropdown in the UI;
--    the legacy type columns stay for display fallback of old rows).
-- 2. Template exercises can carry notes that pre-fill the logger.
-- 3. Template exercises can suggest a weight per set (jsonb array of kg
--    numbers or nulls, aligned to target_sets; blanks stay blank).

alter table public.workouts
  add column name text;

alter table public.template_exercises
  add column notes text;

alter table public.template_exercises
  add column target_weights jsonb;
