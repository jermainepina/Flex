# Flexx (formerly Iron Log) — Project Context

Product name is **Flexx** (renamed 2026-07-09 with the LIFTLOG-style redesign: electric-lime accent tokens, Archivo Black display headings, mono micro-labels, `.card`/`.btn-accent`/`.label-mono` classes in `globals.css`, desktop pill nav + avatar, mobile bottom tab bar). Folder/repo names remain `iron-log`/Flex.

This file is context for Claude Code. Read it at the start of every session before making changes. Keep it updated as decisions change — this doc should always reflect the current state of the project, not the original plan.

## What this is

A multi-user web app for logging gym workouts and tracking progress over time. Users sign in, log exercises with sets/reps/weight, see their history, track volume trends, and build reusable workout templates.

## Stack

- **Frontend**: Next.js (App Router), React, TypeScript
- **Styling**: Tailwind CSS
- **Backend / DB / Auth**: Supabase (Postgres + built-in auth + row-level security)
- **Charts**: Recharts
- **Drag-and-drop**: dnd-kit
- **Hosting**: Vercel (app), Supabase (DB)

Why Supabase over Firebase: the data is inherently relational (sets belong to exercises belong to workouts; templates belong to users and reference exercises), so Postgres is a better fit than a document store. Row-level security also means per-user data isolation is enforced at the DB layer, not hand-rolled in application code.

## Data model

Rough schema — adjust as needed, but keep this section in sync with reality.

```sql
-- users table is managed by Supabase Auth (auth.users). Don't duplicate it;
-- reference auth.users(id) as user_id in the tables below.

profiles
  id             uuid pk references auth.users   -- auto-created by trigger on signup (copies display_name from signup metadata)
  preferred_unit text default 'lb'               -- 'lb' | 'kg'; editable in /settings
  display_name   text                            -- greeting + header (added 0006)
  theme          text default 'dark'             -- 'light' | 'dim' | 'dark' (added 0006); class-based theming, server-rendered on <html>
  created_at     timestamptz default now()

exercises
  id            uuid pk
  user_id       uuid references auth.users, not null
  name          text not null
  muscle_group  muscle_group not null default 'other'  -- enum: chest/back/shoulders/arms/legs/core/other (added 0002, keyword-backfilled)
  created_at    timestamptz default now()
  -- unique(user_id, name)

workouts
  id                uuid pk
  user_id           uuid references auth.users, not null
  date              timestamptz not null
  type              text            -- e.g. 'push', 'pull', 'legs', 'upper', 'lower', 'full_body' — drives the calendar icon
  template_id       uuid references templates(id), nullable
  duration_seconds  int, nullable   -- logging-session length (added 0003, shown on summary page)
  created_at        timestamptz default now()

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
  target_sets   int not null default 1  -- empty set rows to pre-fill when starting from the template (added 0004)
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

### Phase 5 — Rest timer ✅ (built 2026-07-08)

Countdown timer between sets during logging, client-side.
**Done when**: timer starts after a set is logged, is visible during the workout, and can be adjusted/skipped.
Notes: each set row has a done checkmark; checking it starts/restarts the countdown in a sticky bottom bar (`src/components/rest-timer.tsx`) that also shows the elapsed workout clock (starts on page open, saved to `workouts.duration_seconds`). Presets 60/90/120/180s (persisted in localStorage), +15s, Skip; silent at zero by choice. Countdown anchored to an end timestamp so background-tab throttling can't drift it.

### Phase 6 — PR autodetection ✅ (built 2026-07-08)

At log time, compare each set against the user's historical best for that exercise (by weight, and separately by reps at a given weight). Visually highlight the set inline if it's a new PR. Persist `is_pr` on the set.
**Done when**: logging a set that beats history is visibly flagged in the UI immediately, and the flag persists in history afterward.
Notes: rules live in `src/lib/pr.ts` (shared client/server; replica in `scripts/demo-data.mjs` — keep in sync): one weight-PR per session (heaviest set beating history) plus rep-PRs only at previously-lifted weights (session-best reps beating the historical best there). Logger fetches per-exercise bests on selection and outlines a block **gold** with PR chips live; `saveWorkout` recomputes authoritatively and persists `is_pr`. Also added: focus highlight on the exercise block being edited, and a post-save summary page (`/history/[id]/summary`) with duration / total sets / volume count-up and a staggered gold-star PR animation.

### Phase 7 — Template builder ✅ (built 2026-07-08)

Create and name workout templates. Drag-and-drop exercises to build/reorder a template. Starting a workout from a template pre-fills the exercise list (and can pre-fill workout type).
**Done when**: a user can build a template, reorder it via drag-and-drop, and start a new workout pre-populated from it.
Notes: `/templates` (list with Start/Edit/Delete) + `/templates/new` + `/templates/[id]` editor (`src/components/template-editor.tsx`, dnd-kit sortable with pointer + keyboard sensors). Templates store a per-exercise `target_sets` (migration `0004`): starting a workout pre-fills that many empty set rows per exercise, pre-selects type, and auto-loads prev/PR data; entry points are the template cards and the template select on the `/log` start page (originally a header picker; moved 2026-07-10). Saved workouts record `template_id` (verified against RLS before insert).

### Pre-AI polish ✅ (built 2026-07-08)

Refinements before phase 8: (a) workouts renamed from `type` enum to free-text `name` (migration 0005; blank → auto "Workout N"; calendar/history/dashboard show names, type columns legacy-fallback only); (b) template exercises carry `notes` + optional per-set `target_weights` (jsonb kg) that pre-fill the logger; (c) history defaults to calendar view; (d) template delete has an inline confirm; (e) **three selectable themes** — light / dim (slate) / dark (default) in `profiles.theme` (migration 0006), class-based Tailwind dark variant + `--color-zinc-*` overrides for dim, `color-scheme` fixes native select popups; (f) `/settings` page (display name, theme, unit, sign out — replaces header sign-out; sign-up has optional name); (g) **dashboard hub**: greeting, weekly stat tiles (workouts/volume/PRs vs last week), Start-workout CTA, AI-coach placeholder. Note: Apple Watch/HealthKit data is not accessible from web apps — would require a native iOS wrapper.

### Log start page ✅ (built 2026-07-10)

The Log tab no longer opens straight into the logging interface. `/log` is now a **start page** (`src/components/log-start-form.tsx`): optional template select (template-card links `/log?template=<id>` preselect it), date, optional workout name, and rest-timer preset pills (writes the same localStorage store the session bar reads). "Start workout" plays a lime full-screen "LET'S GO" launch animation (skipped under `prefers-reduced-motion`) then navigates to **`/log/active`** — the moved logger route, which accepts `?template&date&name`. In-session, an **Exit** button next to Save (inline Discard? Yes/No confirm) returns to the start page; entered sets are dropped. The old header `TemplatePicker` component was removed.

### AI assistant — built, then removed (2026-07-13)

A Claude-, then Gemini-powered coach was built (aggregation module, cache table, server actions, dashboard card), live-verified, then fully descoped at the user's request the same day. All app-side code and the `@google/genai` dependency were removed; the migration file was deleted too, but the live Supabase `ai_insights` table it created still needs a manual `drop table if exists public.ai_insights;` in the SQL editor to fully clean up (anon key can't run DDL). No AI feature is currently planned. If this comes back, decide the provider/model fresh rather than reusing this round's choices — model IDs and availability shift fast (this attempt hit two dead/quota-zero model IDs before finding one that worked).

### Goals + cardio + Progress merge (built 2026-07-14)

Post-roadmap phase. Three parts:
1. **Goals tab** (`/goals`, migration `0007_goals.sql`): `goals` table (`metric` enum sessions/volume/exercise_weight/cardio_minutes, `period` enum weekly/monthly — null for standing exercise-weight targets, `target` numeric canonical count/kg/minutes, optional `exercise_id`, RLS owner-only). Pure progress math in `src/lib/goals.ts` (`computeGoalProgress`, `goalLabel` — fixture-tested via `scripts/verify-goals.mjs`); create/delete server actions; goal cards with `CircularStat` rings + achieved (lime ring) state. The dashboard's **main card** (full width, top of page) is the goal tracker: every goal stacked vertically with its progress ring + current/target; empty state is a full card linking to `/goals` ("Add a goal →"). Latest-PR info lives as a caption line in the Best lifts card. The training-days heatmap's week columns flex to fill the card width (large dots). **Completion celebration**: when a saved workout (lifting or cardio) pushes a goal over its target, a full-screen overlay fires first (confetti + "GOAL CRUSHED" + goal labels crossed off with staggered strike-through, `goal-celebration.tsx`, `confetti-fall`/`goal-strike` keyframes) with a Continue button onward to the summary/detail page; detection = `newlyCompletedGoals` in `lib/goals.ts` (progress with vs without the new workout's rows, computed fail-soft in `findCompletedGoals` inside `log/actions.ts` — already-achieved goals never re-fire).
2. **Cardio logging mode**: the `/log` start page has a Lifting | Cardio toggle. Cardio mode: kind select (`CARDIO_KINDS` in types.ts — Running/Treadmill/etc., becomes the default session name), date, and a session-length picker (15/20/30/45/60 min presets + custom 5–600). START → `/log/cardio` — a big countdown ring (elapsed vs target, overtime counts up past zero in green), ±5 min mid-session target adjustment, Finish & save / Exit (discard confirm). `saveCardio` in `log/actions.ts` inserts a workout with **`type='cardio'`** (the type enum is no longer legacy-only), a duration, and no exercises — history/calendar render zero-exercise workouts fine, and cardio-minutes goals measure exactly these rows.
3. **Nav merge**: History + Stats became one **Progress** section (tab → `/history`, highlighted for `/trends` too, `ChartLine` icon) with a History | Stats segmented switcher (`progress-switcher.tsx`) on both pages; **Goals** (`Target` icon) took the freed 5th slot in both the mobile bottom bar and desktop pill nav. All routes/deep links unchanged.

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
