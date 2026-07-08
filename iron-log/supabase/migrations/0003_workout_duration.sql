-- Phase 5/6: store how long a logging session took, shown on the workout
-- summary page. Nullable — workouts logged before this feature have none.
-- Run in the Supabase SQL editor (after 0002).

alter table public.workouts
  add column duration_seconds int check (duration_seconds >= 0);
