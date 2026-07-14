import { CircularStat } from "@/components/circular-stat";
import { DeleteGoalButton } from "@/components/delete-goal-button";
import { GoalForm } from "@/components/goal-form";
import { PageHeader } from "@/components/page-header";
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
import { type WeightUnit } from "@/lib/units";
import { bucketKey } from "@/lib/volume";

type GoalRow = {
  id: string;
  metric: GoalMetric;
  period: GoalPeriod | null;
  target: number;
  exercise_id: string | null;
  exercises: { name: string } | null;
};

type WindowSetRow = {
  weight: number;
  reps: number;
  workout_exercises: { workouts: { date: string } };
};

type BestSetRow = {
  weight: number;
  workout_exercises: { exercise_id: string };
};

export default async function GoalsPage() {
  const supabase = await createClient();

  const today = new Date().toISOString().slice(0, 10);
  // Window covering both the current week and the current month.
  const weekStart = bucketKey(today, "weekly");
  const monthStart = `${bucketKey(today, "monthly")}-01`;
  const since = weekStart < monthStart ? weekStart : monthStart;

  const [{ data: profile }, { data: goalRows }, { data: exercises }, { data: windowWorkouts }, { data: windowSets }] =
    await Promise.all([
      supabase.from("profiles").select("preferred_unit").maybeSingle(),
      supabase
        .from("goals")
        .select("id, metric, period, target, exercise_id, exercises(name)")
        .order("created_at", { ascending: false }),
      supabase.from("exercises").select("id, name").order("name"),
      supabase
        .from("workouts")
        .select("date, type, duration_seconds")
        .gte("date", `${since}T00:00:00Z`),
      supabase
        .from("sets")
        .select("weight, reps, workout_exercises!inner(workouts!inner(date))")
        .gte("workout_exercises.workouts.date", `${since}T00:00:00Z`),
    ]);

  const unit: WeightUnit = profile?.preferred_unit === "kg" ? "kg" : "lb";
  const goals = (goalRows ?? []) as unknown as GoalRow[];

  // Heaviest set ever, but only for exercises referenced by weight goals.
  const weightGoalExerciseIds = [
    ...new Set(
      goals
        .filter((g) => g.metric === "exercise_weight" && g.exercise_id)
        .map((g) => g.exercise_id as string),
    ),
  ];
  const exerciseBestKg: Record<string, number> = {};
  if (weightGoalExerciseIds.length > 0) {
    const { data: bestRows } = await supabase
      .from("sets")
      .select("weight, workout_exercises!inner(exercise_id)")
      .in("workout_exercises.exercise_id", weightGoalExerciseIds);
    for (const row of (bestRows ?? []) as unknown as BestSetRow[]) {
      const id = row.workout_exercises.exercise_id;
      exerciseBestKg[id] = Math.max(exerciseBestKg[id] ?? 0, row.weight);
    }
  }

  const workouts = windowWorkouts ?? [];
  const inputs: GoalInputs = {
    today,
    workoutDates: workouts.map((w) => w.date),
    setRows: ((windowSets ?? []) as unknown as WindowSetRow[]).map((s) => ({
      date: s.workout_exercises.workouts.date,
      weightKg: s.weight,
      reps: s.reps,
    })),
    cardioRows: workouts
      .filter((w) => w.type === "cardio")
      .map((w) => ({ date: w.date, durationSeconds: w.duration_seconds ?? 0 })),
    exerciseBestKg,
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        kicker={new Date().toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
        titleA="Training"
        titleB="Goals"
      />

      <GoalForm exercises={exercises ?? []} unit={unit} />

      {goals.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No goals yet — set your first one above.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {goals.map((row) => {
            const goal: Goal = {
              id: row.id,
              metric: row.metric,
              period: row.period,
              target: Number(row.target),
              exerciseId: row.exercise_id,
            };
            const progress = computeGoalProgress(goal, inputs);
            return (
              <section
                key={goal.id}
                className={`card flex items-center gap-4 p-4 ${
                  progress.achieved ? "ring-2 ring-[var(--accent)]" : ""
                }`}
              >
                <CircularStat pct={progress.pct} size={56} strokeWidth={5}>
                  <span className="font-display text-sm">
                    {progress.achieved ? "✓" : `${Math.round(progress.pct * 100)}%`}
                  </span>
                </CircularStat>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {goalLabel(goal, row.exercises?.name ?? null, unit)}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {goalValueLabel(goal, progress.current, unit)} of{" "}
                    {goalValueLabel(goal, progress.target, unit)}
                    {goal.metric === "exercise_weight" ? " (best ever)" : ""}
                  </p>
                  {progress.achieved && (
                    <p className="label-mono mt-0.5" style={{ color: "var(--accent-text)" }}>
                      Achieved
                    </p>
                  )}
                </div>
                <DeleteGoalButton goalId={goal.id} />
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
