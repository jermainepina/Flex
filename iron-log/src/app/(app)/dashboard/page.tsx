import Link from "next/link";
import { CircularStat } from "@/components/circular-stat";
import { PageHeader } from "@/components/page-header";
import { TrainingHeatmap } from "@/components/training-heatmap";
import {
  computeGoalProgress,
  goalLabel,
  goalValueLabel,
  type Goal,
  type GoalInputs,
  type GoalMetric,
  type GoalPeriod,
} from "@/lib/goals";
import { createClient } from "@/lib/supabase/server";
import { nameColorVar, workoutDisplayName, type WorkoutType } from "@/lib/types";
import { formatWeight, kgToUnit, type WeightUnit } from "@/lib/units";
import { bucketKey } from "@/lib/volume";

type RecentWorkout = {
  id: string;
  date: string;
  name: string | null;
  type: WorkoutType | null; // legacy fallback label
  duration_seconds: number | null;
  workout_exercises: { count: number }[];
};

type WideSetRow = {
  weight: number;
  reps: number;
  is_pr: boolean;
  workout_exercises: { workout_id: string; workouts: { date: string } };
};

type BestRow = {
  weight: number;
  workout_exercises: {
    workout_id: string;
    exercise_id: string;
    exercises: { name: string };
  };
};

type LatestPrRow = {
  weight: number;
  workout_exercises: {
    exercises: { name: string };
    workouts: { date: string };
  };
};

type GoalRow = {
  id: string;
  metric: GoalMetric;
  period: GoalPeriod | null;
  target: number;
  exercise_id: string | null;
  exercises: { name: string } | null;
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function isoAddDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function isoWeekNumber(iso: string): number {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7);
}

const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function Delta({ diff, suffix }: { diff: number; suffix?: string }) {
  if (diff === 0) {
    return (
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        same as last week
      </p>
    );
  }
  return (
    <p
      className={`mt-1 text-xs font-medium ${
        diff > 0
          ? "text-emerald-700 dark:text-emerald-400"
          : "text-red-600 dark:text-red-400"
      }`}
    >
      {diff > 0 ? "↑" : "↓"} {Math.abs(diff).toLocaleString("en-US")}
      {suffix ?? ""} vs last week
    </p>
  );
}

function StatTile({
  label,
  value,
  suffix,
  delta,
}: {
  label: string;
  value: string;
  suffix?: string;
  delta?: React.ReactNode;
}) {
  return (
    <div className="card p-3 sm:p-4">
      <p className="label-mono">{label}</p>
      <p className="font-display mt-1.5 text-2xl leading-none sm:text-3xl">
        {value}
        {suffix && (
          <span className="ml-1 font-sans text-sm font-normal text-zinc-500 dark:text-zinc-400">
            {suffix}
          </span>
        )}
      </p>
      {delta}
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const today = new Date().toISOString().slice(0, 10);
  const thisMonday = bucketKey(today, "weekly");
  const lastMonday = isoAddDays(thisMonday, -7);
  const since = isoAddDays(today, -90);

  const [
    { data: profile },
    { data: userData },
    { data: recent },
    { data: recentSets },
    { data: bestSets },
    { data: streakRows },
    { data: latestPrRows },
    { data: goalRows },
  ] = await Promise.all([
    supabase.from("profiles").select("display_name, preferred_unit").maybeSingle(),
    supabase.auth.getUser(),
    supabase
      .from("workouts")
      .select("id, date, name, type, duration_seconds, workout_exercises(count)")
      .order("date", { ascending: false })
      .limit(5),
    supabase
      .from("sets")
      .select(
        "weight, reps, is_pr, workout_exercises!inner(workout_id, workouts!inner(date))",
      )
      .gte("workout_exercises.workouts.date", `${since}T00:00:00Z`),
    supabase
      .from("sets")
      .select(
        "weight, workout_exercises!inner(workout_id, exercise_id, exercises!inner(name))",
      ),
    supabase
      .from("workouts")
      .select("date, name, type, duration_seconds")
      .gte("date", `${since}T00:00:00Z`),
    supabase
      .from("sets")
      .select(
        "weight, workout_exercises!inner(exercises!inner(name), workouts!inner(date))",
      )
      .eq("is_pr", true)
      .order("date", { referencedTable: "workout_exercises.workouts", ascending: false })
      .limit(1),
    supabase
      .from("goals")
      .select("id, metric, period, target, exercise_id, exercises(name)")
      .order("created_at", { ascending: false }),
  ]);

  const unit: WeightUnit = profile?.preferred_unit === "kg" ? "kg" : "lb";
  const greetName =
    profile?.display_name?.trim() ||
    userData.user?.email?.split("@")[0] ||
    "there";

  // Weekly tiles + per-workout tonnage from one 90-day sets query.
  const weekOf = (date: string) => bucketKey(date, "weekly");
  const tonnageByWorkout = new Map<string, { date: string; kg: number }>();
  let volThisKg = 0;
  let volLastKg = 0;
  let prsThis = 0;
  let prsLast = 0;
  for (const row of (recentSets ?? []) as unknown as WideSetRow[]) {
    const { workout_id, workouts } = row.workout_exercises;
    const cur = tonnageByWorkout.get(workout_id) ?? { date: workouts.date, kg: 0 };
    cur.kg += row.weight * row.reps;
    tonnageByWorkout.set(workout_id, cur);
    const wk = weekOf(workouts.date);
    if (wk === thisMonday) {
      volThisKg += row.weight * row.reps;
      if (row.is_pr) prsThis++;
    } else if (wk === lastMonday) {
      volLastKg += row.weight * row.reps;
      if (row.is_pr) prsLast++;
    }
  }
  const volThis = Math.round(kgToUnit(volThisKg, unit));
  const volLast = Math.round(kgToUnit(volLastKg, unit));

  const trainedDays = new Set(
    (streakRows ?? []).map((w) => w.date.slice(0, 10)),
  );
  const workoutsThis = [...trainedDays].filter(
    (d) => weekOf(d) === thisMonday,
  ).length;
  const workoutsLast = [...trainedDays].filter(
    (d) => weekOf(d) === lastMonday,
  ).length;

  // Streak: consecutive trained days ending today (or yesterday).
  let streak = 0;
  let cursor = trainedDays.has(today) ? today : isoAddDays(today, -1);
  while (trainedDays.has(cursor)) {
    streak++;
    cursor = isoAddDays(cursor, -1);
  }

  const heatmapDays = (streakRows ?? []) as {
    date: string;
    name: string | null;
    type: string | null;
    duration_seconds: number | null;
  }[];
  const workouts = (recent ?? []) as RecentWorkout[];

  // PR hero card: most recent PR (weight + exercise + time-ago).
  const latestPr =
    ((latestPrRows ?? []) as unknown as LatestPrRow[])[0] ?? null;

  // Best lifts: top 4 by session count; heaviest overall gets TOP PR.
  const perExercise = new Map<
    string,
    { name: string; workouts: Set<string>; maxKg: number }
  >();
  for (const row of (bestSets ?? []) as unknown as BestRow[]) {
    const we = row.workout_exercises;
    const cur =
      perExercise.get(we.exercise_id) ??
      { name: we.exercises.name, workouts: new Set<string>(), maxKg: 0 };
    cur.workouts.add(we.workout_id);
    cur.maxKg = Math.max(cur.maxKg, row.weight);
    perExercise.set(we.exercise_id, cur);
  }
  const bestLifts = [...perExercise.values()]
    .sort((a, b) => b.workouts.size - a.workouts.size)
    .slice(0, 4);
  const topPrKg = Math.max(0, ...bestLifts.map((l) => l.maxKg));

  // Goal progress from aggregates this page already has: streak rows (dates,
  // cardio durations), the 90-day sets query (volume), and the all-time
  // per-exercise maxes computed above for best lifts.
  const goals = (goalRows ?? []) as unknown as GoalRow[];
  const goalInputs: GoalInputs = {
    today,
    workoutDates: heatmapDays.map((d) => d.date),
    setRows: ((recentSets ?? []) as unknown as WideSetRow[]).map((r) => ({
      date: r.workout_exercises.workouts.date,
      weightKg: r.weight,
      reps: r.reps,
    })),
    cardioRows: heatmapDays
      .filter((d) => d.type === "cardio")
      .map((d) => ({ date: d.date, durationSeconds: d.duration_seconds ?? 0 })),
    exerciseBestKg: Object.fromEntries(
      [...perExercise.entries()].map(([id, v]) => [id, v.maxKg]),
    ),
  };
  const goalProgress = goals.map((row) => {
    const goal: Goal = {
      id: row.id,
      metric: row.metric,
      period: row.period,
      target: Number(row.target),
      exerciseId: row.exercise_id,
    };
    return {
      goal,
      label: goalLabel(goal, row.exercises?.name ?? null, unit),
      progress: computeGoalProgress(goal, goalInputs),
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        kicker={`WK ${isoWeekNumber(today)} — ${new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" }).toUpperCase()} · HI, ${greetName.toUpperCase()}`}
        titleA="Performance"
        titleB="Overview"
        action={
          <Link href="/log" className="btn-accent px-5 py-3 text-sm">
            + Log workout
          </Link>
        }
      />

      {goalProgress.length === 0 ? (
        <Link href="/goals" className="card flex items-center justify-between gap-3 p-5">
          <div>
            <p className="label-mono">Targets</p>
            <p className="mt-1 font-semibold">No goals yet</p>
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
              Set a weekly or monthly target and track it here.
            </p>
          </div>
          <span
            className="shrink-0 text-sm font-medium"
            style={{ color: "var(--accent-text)" }}
          >
            Add a goal →
          </span>
        </Link>
      ) : (
        <section className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="label-mono">Targets</p>
              <h2 className="mt-1 font-semibold">Goals</h2>
            </div>
            <Link
              href="/goals"
              className="text-sm font-medium"
              style={{ color: "var(--accent-text)" }}
            >
              Manage →
            </Link>
          </div>
          <ul className="mt-4 flex flex-col gap-4">
            {goalProgress.map(({ goal, label, progress }) => (
              <li key={goal.id} className="flex items-center gap-4">
                <CircularStat pct={progress.pct} size={52} strokeWidth={5}>
                  <span className="font-display text-xs">
                    {progress.achieved ? "✓" : `${Math.round(progress.pct * 100)}%`}
                  </span>
                </CircularStat>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{label}</p>
                  <p
                    className="label-mono"
                    style={
                      progress.achieved ? { color: "var(--accent-text)" } : undefined
                    }
                  >
                    {progress.achieved
                      ? "Achieved"
                      : `${goalValueLabel(goal, progress.current, unit)} / ${goalValueLabel(goal, progress.target, unit)}`}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <StatTile
          label="Sessions"
          value={String(workoutsThis)}
          delta={<Delta diff={workoutsThis - workoutsLast} />}
        />
        <StatTile
          label="Week volume"
          value={compact.format(volThis)}
          suffix={unit}
          delta={<Delta diff={volThis - volLast} suffix={` ${unit}`} />}
        />
        <StatTile
          label="PRs"
          value={String(prsThis)}
          delta={<Delta diff={prsThis - prsLast} />}
        />
        <StatTile label="Streak" value={String(streak)} suffix="days" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <p className="label-mono">Consistency</p>
          <h2 className="mt-1 font-semibold">Training days</h2>
          {heatmapDays.length > 0 ? (
            <div className="mt-3">
              <TrainingHeatmap days={heatmapDays} sinceDate={since} untilDate={today} />
            </div>
          ) : (
            <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
              Log a couple of workouts to see your training days.
            </p>
          )}
        </div>

        <div className="card p-4">
          <p className="label-mono">Personal records</p>
          <h2 className="mt-1 font-semibold">Best lifts</h2>
          {latestPr && (
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Latest PR: {formatWeight(latestPr.weight, unit)}{" "}
              {latestPr.workout_exercises.exercises.name} ·{" "}
              {timeAgo(latestPr.workout_exercises.workouts.date)}
            </p>
          )}
          {bestLifts.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
              No lifts logged yet.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {bestLifts.map((lift) => {
                const isTop = lift.maxKg === topPrKg && topPrKg > 0;
                return (
                  <li
                    key={lift.name}
                    className="flex items-center justify-between rounded-xl border px-3 py-2.5"
                    style={
                      isTop
                        ? {
                            borderColor: "var(--accent)",
                            background:
                              "color-mix(in srgb, var(--accent) 8%, transparent)",
                          }
                        : { borderColor: "transparent" }
                    }
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {lift.name}
                      </span>
                      {isTop && (
                        <span
                          className="label-mono"
                          style={{ color: "var(--accent-text)" }}
                        >
                          Top PR
                        </span>
                      )}
                    </span>
                    <span className="font-display shrink-0 text-lg">
                      {formatWeight(lift.maxKg, unit)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <section className="card p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="label-mono">History</p>
            <h2 className="mt-1 font-semibold">Recent sessions</h2>
          </div>
          <Link
            href="/history"
            className="text-sm font-medium"
            style={{ color: "var(--accent-text)" }}
          >
            View all →
          </Link>
        </div>
        {workouts.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            No workouts yet. Log your first one to get started.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {workouts.map((w) => {
              const exerciseCount = w.workout_exercises[0]?.count ?? 0;
              const label = workoutDisplayName(w.name, w.type);
              const tonnage = tonnageByWorkout.get(w.id);
              const mins = w.duration_seconds
                ? Math.round(w.duration_seconds / 60)
                : null;
              return (
                <li key={w.id}>
                  <Link
                    href={`/history/${w.id}?from=dashboard`}
                    className="flex items-center gap-3 rounded-xl border border-zinc-200 px-3 py-3 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"
                  >
                    <span className="label-mono shrink-0">
                      {w.date.slice(5, 10)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-sm font-medium">
                        <span
                          aria-hidden
                          className="inline-block h-2 w-2 shrink-0 rounded-full"
                          style={{ background: nameColorVar(label) }}
                        />
                        <span className="truncate">{label}</span>
                      </span>
                      <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                        {exerciseCount} exercise{exerciseCount === 1 ? "" : "s"}
                        {mins !== null ? ` · ${mins}min` : ""}
                      </span>
                    </span>
                    {tonnage && tonnage.kg > 0 && (
                      <span className="shrink-0 text-right">
                        <span className="font-display block text-lg leading-none">
                          {compact.format(Math.round(kgToUnit(tonnage.kg, unit)))}
                        </span>
                        <span className="label-mono">{unit} vol</span>
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
