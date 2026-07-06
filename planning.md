# Iron Log — Project Context

This file is context for Claude Code. Read it at the start of every session before making changes. Keep it updated as decisions change — this doc should always reflect the current state of the project, not the original plan.

## What this is

A multi-user web app for logging gym workouts and tracking progress over time. Users sign in, log exercises with sets/reps/weight, see their history, track volume trends, build reusable workout templates, and (eventually) get AI-generated performance insights.

## Stack

- **Frontend**: Next.js (App Router), React, TypeScript
- **Styling**: Tailwind CSS
- **Backend / DB / Auth**: Supabase (Postgres + built-in auth + row-level security)
- **Charts**: Recharts
- **Drag-and-drop**: dnd-kit
- **Hosting**: Vercel (app), Supabase (DB)
- **AI assistant (phase 8)**: Claude API, fed pre-aggregated stats computed server-side — never raw table dumps

Why Supabase over Firebase: the data is inherently relational (sets belong to exercises belong to workouts; templates belong to users and reference exercises), so Postgres is a better fit than a document store. Row-level security also means per-user data isolation is enforced at the DB layer, not hand-rolled in application code.

## Data model

Rough schema — adjust as needed, but keep this section in sync with reality.

```sql
-- users table is managed by Supabase Auth (auth.users). Don't duplicate it;
-- reference auth.users(id) as user_id in the tables below.

profiles
  id             uuid pk references auth.users   -- auto-created by trigger on signup
  preferred_unit text default 'lb'               -- 'lb' | 'kg'; settings UI is a later phase
  created_at     timestamptz default now()

exercises
  id            uuid pk
  user_id       uuid references auth.users, not null
  name          text not null
  muscle_group  muscle_group not null default 'other'  -- enum: chest/back/shoulders/arms/legs/core/other (added 0002, keyword-backfilled)
  created_at    timestamptz default now()
  -- unique(user_id, name)

workouts
  id            uuid pk
  user_id       uuid references auth.users, not null
  date          timestamptz not null
  type          text            -- e.g. 'push', 'pull', 'legs', 'upper', 'lower', 'full_body' — drives the calendar icon
  template_id   uuid references templates(id), nullable
  created_at    timestamptz default now()

workout_exercises
  id            uuid pk
  workout_id    uuid references workouts(id) on delete cascade
  exercise_id   uuid references exercises(id)
  notes         text
  position      int             -- order within the workout

sets
  id                    uuid pk
  workout_exercise_id   uuid references workout_exercises(id) on delete cascade
  set_number            int not null
  weight                numeric not null        -- stored in kg; converted to/from the user's unit in the UI
  reps                  int not null
  is_pr                 boolean default false   -- set at log time by comparing against historical bests

templates
  id            uuid pk
  user_id       uuid references auth.users, not null
  name          text not null
  type          text            -- same enum as workouts.type, used as the default when a workout is created from this template
  created_at    timestamptz default now()

template_exercises
  id            uuid pk
  template_id   uuid references templates(id) on delete cascade
  exercise_id   uuid references exercises(id)
  position      int             -- drag-and-drop order
```

Notes:

- Row-level security policies on every table: a user can only select/insert/update/delete rows where `user_id` matches `auth.uid()` (for child tables like `sets`, join up to the owning `workout`/`template`).
- `is_pr` is computed and stored at write time (compare the new set's weight/reps against the user's historical best for that exercise) rather than recomputed on every read — cheaper for charts and history views later.
- `workouts.type` and `templates.type` share a Postgres enum `workout_type`: push / pull / legs / upper / lower / full_body / cardio / other. (Resolved 2026-07-02.)
- The schema lives in `iron-log/supabase/migrations/0001_init.sql` and was created in full up front (templates included) so later phases don't need FK-breaking migrations.

## Feature phases

Build and commit in this order. Each phase should be its own Claude Code session, scoped to one feature area. Don't bundle phases together in a single prompt — verify one works before starting the next.

### Phase 1 — Scaffold + auth ✅ (built 2026-07-02)

Next.js app wired to Supabase. Sign up, sign in, sign out. Protected dashboard route.
**Done when**: a new user can create an account, log in, log out, and an unauthenticated visitor gets redirected to sign-in.
Notes: app lives in `iron-log/`. Next.js 16 — route protection uses `src/proxy.ts` (Next 16's rename of `middleware.ts`) with `@supabase/ssr`.

### Phase 2 — Core logging (DB-backed) ✅ (built 2026-07-02)

Exercise dropdown with "create new exercise," set/rep/weight entry with multiple sets per exercise, notes, submit to save a workout. Shows previous weight/reps for the selected exercise, scoped to the logged-in user.
**Done when**: a logged-in user can log a full workout with several exercises and it persists in Supabase, correctly scoped to their account only.

### Phase 3 — History + calendar view ✅ (built 2026-07-06)

List of past workouts. Calendar view showing a small icon per day representing workout type (push/pull/legs/etc, from `workouts.type`).
**Done when**: past workouts are browsable in list form and on a calendar with correct type icons.
Notes: single `/history` page with List | Calendar toggle (`?view=`, `?month=YYYY-MM`); emoji type icons (`WORKOUT_TYPE_EMOJI` in `src/lib/types.ts`); added `/history/[id]` workout detail page (sets/weights/reps/notes) — dashboard rows link to it. Calendar groups by the UTC date part since workouts are stored at noon UTC.

### Phase 4 — Volume trends ✅ (built 2026-07-06)

Weekly, monthly, yearly volume charts, plus exercise-specific trend charts (e.g. weight progression on bench press over time).
**Done when**: charts render real data from the user's history and update as new workouts are logged.
Notes: `/trends` page (Recharts) — total tonnage (weight × reps) bars with weekly/monthly/yearly toggle and zero-filled gaps, plus per-exercise top-set-weight line (defaults to most-logged exercise). Pure aggregation in `src/lib/volume.ts`. Demo account for testing: `npm run seed:demo` seeds `ironlog.demo@gmail.com` / `demo-IronLog-2026!` with 26 deterministic weeks of PPL data (`iron-log/scripts/`); re-running wipes and reseeds.
Trends v2 (2026-07-06): split into Overview | By exercise tabs. Overview adds main-lift cards (top 3 most-logged: best Epley e1RM + rolling rate of progression over trailing 5 weeks, lb/wk and ≈lb/mo) and weekly volume stacked by muscle group (7-slot colorblind-validated palette, legend + table view). By-exercise adds an estimated-1RM (Epley: weight × (1 + reps/30)) chart alongside top-set weight. Migration `0002_muscle_groups.sql` added `exercises.muscle_group` with keyword backfill; create-exercise flow now asks for the group (auto-guessed from the name — keep `guessMuscleGroup()` in `src/lib/types.ts` in sync with the SQL patterns).

### Phase 5 — Rest timer

Countdown timer between sets during logging, client-side.
**Done when**: timer starts after a set is logged, is visible during the workout, and can be adjusted/skipped.

### Phase 6 — PR autodetection

At log time, compare each set against the user's historical best for that exercise (by weight, and separately by reps at a given weight). Visually highlight the set inline if it's a new PR. Persist `is_pr` on the set.
**Done when**: logging a set that beats history is visibly flagged in the UI immediately, and the flag persists in history afterward.

### Phase 7 — Template builder

Create and name workout templates. Drag-and-drop exercises to build/reorder a template. Starting a workout from a template pre-fills the exercise list (and can pre-fill workout type).
**Done when**: a user can build a template, reorder it via drag-and-drop, and start a new workout pre-populated from it.

### Phase 8 — AI assistant

Aggregate a user's recent performance server-side (volume trends, PRs, frequency, muscle group balance) and send that summary — not raw logs — to the Claude API. Returns weekly/monthly performance summaries and suggested workouts, exercises, or splits.
**Done when**: a user can request an assessment and get a coherent, data-grounded summary and suggestion back.

## Working conventions

- Propose a plan before writing code for any non-trivial change; wait for confirmation before implementing.
- Keep changes scoped to the current phase. If a change touches a future phase's territory, flag it rather than building ahead.
- Commit working code at the end of each phase (or each meaningful sub-step within a phase) before moving on — always leave a clean rollback point.
- Update this file when a real decision diverges from what's written here (schema changes, library swaps, scope changes). This doc should never go stale.
- Never log raw user data to third-party services. The AI assistant (phase 8) only ever sends pre-aggregated summaries, not full workout history.

## Open questions — resolved 2026-07-02

- Workout `type` values: push / pull / legs / upper / lower / full_body / cardio / other (Postgres enum).
- Templates are strictly private per user (RLS owner-only policies; sharing later would be a policy change).
- Units: per-user preference in `profiles.preferred_unit` ('lb' | 'kg', default lb). Weights stored canonically in kg; converted at entry/display (`src/lib/units.ts`) so PR comparisons survive a unit switch. Settings UI to change the preference is still to be built.
- PR definition (phase 6): two tracked types — heaviest weight ever for the exercise, and most reps at a given weight.
