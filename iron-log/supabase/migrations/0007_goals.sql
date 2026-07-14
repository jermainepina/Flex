-- Goals phase: user-set weekly/monthly targets (sessions, volume, cardio
-- minutes) and standing exercise-weight targets. Progress is computed from
-- existing workout/set data at read time — nothing else is denormalized.
-- Run in the Supabase SQL editor (after 0006).
--
-- Targets are stored canonically: session counts as-is, weights/volume in kg,
-- cardio in minutes. Cardio sessions are workouts saved with type = 'cardio'
-- (the existing workout_type enum — no longer legacy-only as of this phase).

create type goal_metric as enum ('sessions', 'volume', 'exercise_weight', 'cardio_minutes');
create type goal_period as enum ('weekly', 'monthly');

create table public.goals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  metric      goal_metric not null,
  period      goal_period, -- null = standing goal (exercise_weight)
  target      numeric not null check (target > 0),
  exercise_id uuid references public.exercises (id) on delete cascade,
  created_at  timestamptz not null default now(),
  check (metric <> 'exercise_weight' or exercise_id is not null),
  check (metric = 'exercise_weight' or period is not null)
);

alter table public.goals enable row level security;

create policy "own goals" on public.goals
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
