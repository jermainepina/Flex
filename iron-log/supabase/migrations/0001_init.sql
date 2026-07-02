-- Iron Log — initial schema.
-- Run this in the Supabase SQL editor (or via `supabase db push`).
-- Covers the full data model up front (templates included) so later phases
-- don't need FK-breaking migrations. Weights in `sets.weight` are stored in kg;
-- the UI converts to/from the user's preferred unit.

-- Shared by workouts.type and templates.type; drives the calendar icon (phase 3).
create type workout_type as enum (
  'push', 'pull', 'legs', 'upper', 'lower', 'full_body', 'cardio', 'other'
);

-- Per-user settings. auth.users is managed by Supabase Auth; don't duplicate it.
create table public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  preferred_unit text not null default 'lb' check (preferred_unit in ('lb', 'kg')),
  created_at     timestamptz not null default now()
);

-- Auto-create a profile row for every new auth user.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.exercises (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.templates (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  type       workout_type,
  created_at timestamptz not null default now()
);

create table public.workouts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  date        timestamptz not null,
  type        workout_type,
  template_id uuid references public.templates (id) on delete set null,
  created_at  timestamptz not null default now()
);

create table public.workout_exercises (
  id          uuid primary key default gen_random_uuid(),
  workout_id  uuid not null references public.workouts (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id),
  notes       text,
  position    int not null default 0
);

create table public.sets (
  id                  uuid primary key default gen_random_uuid(),
  workout_exercise_id uuid not null references public.workout_exercises (id) on delete cascade,
  set_number          int not null,
  weight              numeric not null check (weight >= 0), -- kg
  reps                int not null check (reps > 0),
  is_pr               boolean not null default false -- set at log time (phase 6)
);

create table public.template_exercises (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.templates (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id),
  position    int not null default 0
);

create index exercises_user_id_idx on public.exercises (user_id);
create index workouts_user_id_date_idx on public.workouts (user_id, date desc);
create index workout_exercises_workout_id_idx on public.workout_exercises (workout_id);
create index workout_exercises_exercise_id_idx on public.workout_exercises (exercise_id);
create index sets_workout_exercise_id_idx on public.sets (workout_exercise_id);
create index template_exercises_template_id_idx on public.template_exercises (template_id);

-- Row-level security: owner-only on every table. Child tables (workout_exercises,
-- sets, template_exercises) join up to the owning workout/template. Templates are
-- strictly private; sharing would be a policy change here.
alter table public.profiles enable row level security;
alter table public.exercises enable row level security;
alter table public.templates enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.sets enable row level security;
alter table public.template_exercises enable row level security;

create policy "own profile select" on public.profiles
  for select using (id = auth.uid());
create policy "own profile update" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy "own exercises" on public.exercises
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own templates" on public.templates
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own workouts" on public.workouts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own workout_exercises" on public.workout_exercises
  for all using (
    exists (
      select 1 from public.workouts w
      where w.id = workout_id and w.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.workouts w
      where w.id = workout_id and w.user_id = auth.uid()
    )
  );

create policy "own sets" on public.sets
  for all using (
    exists (
      select 1 from public.workout_exercises we
      join public.workouts w on w.id = we.workout_id
      where we.id = workout_exercise_id and w.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.workout_exercises we
      join public.workouts w on w.id = we.workout_id
      where we.id = workout_exercise_id and w.user_id = auth.uid()
    )
  );

create policy "own template_exercises" on public.template_exercises
  for all using (
    exists (
      select 1 from public.templates t
      where t.id = template_id and t.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.templates t
      where t.id = template_id and t.user_id = auth.uid()
    )
  );
