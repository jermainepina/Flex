-- Nutrition phase: daily macro targets, quick food logging, and a daily
-- body-weight log. Profile gains height + optional birth year/sex (used only
-- for calorie suggestions via Mifflin-St Jeor; suggestions fall back to a
-- weight-based heuristic without them). Weight canonical kg, height cm.
-- Run in the Supabase SQL editor (after 0009).

alter table public.profiles
  add column height_cm numeric,
  add column birth_year int check (birth_year between 1900 and 2100),
  add column sex text check (sex in ('male', 'female'));

create table public.nutrition_goals (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  calories   int not null check (calories > 0),
  protein_g  int not null check (protein_g >= 0),
  carbs_g    int not null check (carbs_g >= 0),
  fat_g      int not null check (fat_g >= 0),
  sugar_g    int not null check (sugar_g >= 0), -- "stay under" target
  updated_at timestamptz not null default now()
);

create table public.food_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  date       date not null,
  name       text, -- optional ("Lunch", "Protein shake")
  calories   numeric not null default 0 check (calories >= 0),
  protein_g  numeric not null default 0 check (protein_g >= 0),
  carbs_g    numeric not null default 0 check (carbs_g >= 0),
  fat_g      numeric not null default 0 check (fat_g >= 0),
  sugar_g    numeric not null default 0 check (sugar_g >= 0),
  created_at timestamptz not null default now()
);

create index food_logs_user_date on public.food_logs (user_id, date);

create table public.body_weight_logs (
  user_id   uuid not null references auth.users (id) on delete cascade,
  date      date not null,
  weight_kg numeric not null check (weight_kg > 0),
  primary key (user_id, date) -- one weigh-in per day, upserted
);

alter table public.nutrition_goals enable row level security;
alter table public.food_logs enable row level security;
alter table public.body_weight_logs enable row level security;

create policy "own nutrition_goals" on public.nutrition_goals
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own food_logs" on public.food_logs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own body_weight_logs" on public.body_weight_logs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
