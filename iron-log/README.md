# Iron Log

Multi-user web app for logging gym workouts and tracking progress over time. Next.js (App Router) + TypeScript + Tailwind, with Supabase for Postgres, auth, and row-level security.

Project context and the phased feature roadmap live in [`../planning.md`](../planning.md).

## One-time Supabase setup

1. **Create a project**: go to [supabase.com](https://supabase.com), sign up (free tier is fine), and create a new project. Pick any name/region; save the database password somewhere safe (you won't need it for the app).
2. **Run the migration**: in the Supabase dashboard, open **SQL Editor**, paste the entire contents of [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql), and click **Run**. This creates all tables, the profile trigger, and row-level security policies.
3. **Get your API keys**: go to **Project Settings → API** and copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. **Configure the app**: put those two values in `.env.local` (see `.env.example`).
5. **(Recommended for development)** In **Authentication → Providers → Email**, turn **off** "Confirm email" so sign-ups work instantly without an email round-trip.
   - If you leave confirmation on, also edit the confirmation email template (**Authentication → Emails → Confirm signup**) to link to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`, and set the Site URL to `http://localhost:3000` while developing.

## Run it

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to sign-in. Create an account, then log a workout.

## What works so far

- **Phase 1 — Auth**: email/password sign up, sign in, sign out; all app routes are protected and redirect to sign-in when logged out.
- **Phase 2 — Core logging**: log a workout (date + type) with multiple exercises, sets (weight/reps), and notes; create new exercises inline; see your previous performance for an exercise while logging; recent workouts on the dashboard.

Weights are stored in **kg** in the database and displayed in your preferred unit (default **lb**, per-user setting in the `profiles` table — settings UI comes in a later phase).

## Structure

- `src/proxy.ts` + `src/lib/supabase/middleware.ts` — session refresh + route protection
- `src/lib/supabase/{client,server}.ts` — Supabase clients (browser / server)
- `src/app/(auth)/` — sign-in / sign-up pages and auth server actions
- `src/app/(app)/` — protected app: dashboard, workout logging
- `src/components/workout-logger.tsx` — the logging UI
- `supabase/migrations/` — database schema (run manually in Supabase SQL editor)
