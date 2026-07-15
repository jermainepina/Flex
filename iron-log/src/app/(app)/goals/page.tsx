import { GoalForm } from "@/components/goal-form";
import { GoalList, type GoalListItem } from "@/components/goal-list";
import { GoalWizard } from "@/components/goal-wizard";
import { NutritionTargets } from "@/components/nutrition-targets";
import { PageHeader } from "@/components/page-header";
import type { NutritionTargets as Targets } from "@/lib/nutrition";
import {
  computeGoalProgress,
  goalLabel,
  goalValueLabel,
  goalWindow,
  type Goal,
  type GoalInputs,
  type GoalMetric,
  type GoalPeriod,
  type WeekAnchor,
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
  created_at: string;
  week_anchor: WeekAnchor;
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
  // Wizard volume anchor: the last 4 full-ish weeks of lifting.
  const wizardSinceDate = new Date(`${today}T00:00:00Z`);
  wizardSinceDate.setUTCDate(wizardSinceDate.getUTCDate() - 28);
  const wizardSince = wizardSinceDate.toISOString().slice(0, 10);

  // Stage 1: goals first — their windows decide how far back stage 2 fetches.
  const [
    { data: profile },
    { data: goalRows },
    { data: exercises },
    { data: wizardSets },
    { data: recentWorkoutDays },
    { data: nutritionRow },
    { data: latestWeigh },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("preferred_unit, height_cm, birth_year, sex")
      .maybeSingle(),
    supabase
      .from("goals")
      .select(
        "id, metric, period, target, exercise_id, created_at, week_anchor, exercises(name)",
      )
      .order("position", { ascending: true })
      .order("created_at", { ascending: false }),
    supabase.from("exercises").select("id, name").order("name"),
    supabase
      .from("sets")
      .select("weight, reps, workout_exercises!inner(workouts!inner(date))")
      .gte("workout_exercises.workouts.date", `${wizardSince}T00:00:00Z`),
    supabase
      .from("workouts")
      .select("date")
      .gte("date", `${wizardSince}T00:00:00Z`),
    supabase
      .from("nutrition_goals")
      .select("calories, protein_g, carbs_g, fat_g, sugar_g")
      .maybeSingle(),
    supabase
      .from("body_weight_logs")
      .select("weight_kg")
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const unit: WeightUnit = profile?.preferred_unit === "kg" ? "kg" : "lb";
  const rows = (goalRows ?? []) as unknown as GoalRow[];
  const goals: (Goal & { exerciseName: string | null })[] = rows.map((row) => ({
    id: row.id,
    metric: row.metric,
    period: row.period,
    target: Number(row.target),
    exerciseId: row.exercise_id,
    createdAt: row.created_at,
    weekAnchor: row.week_anchor ?? "monday",
    exerciseName: row.exercises?.name ?? null,
  }));

  let avgWeeklyVolumeKg: number | null = null;
  const wizardRows = (wizardSets ?? []) as unknown as WindowSetRow[];
  if (wizardRows.length > 0) {
    avgWeeklyVolumeKg =
      wizardRows.reduce((sum, s) => sum + s.weight * s.reps, 0) / 4;
  }

  // Real training frequency for nutrition suggestions: distinct trained days
  // over the last 4 weeks.
  const trainedDays = new Set(
    (recentWorkoutDays ?? []).map((w) => w.date.slice(0, 10)),
  );
  const sessionsPerWeek = trainedDays.size / 4;

  const nutritionTargets: Targets | null = nutritionRow
    ? {
        calories: nutritionRow.calories,
        proteinG: nutritionRow.protein_g,
        carbsG: nutritionRow.carbs_g,
        fatG: nutritionRow.fat_g,
        sugarG: nutritionRow.sugar_g,
      }
    : null;

  // Stage 2: aggregates reaching back to the earliest goal window start
  // (goals are one-shot; missed ones get cleaned up on this page, so this
  // stays around a month of data).
  const weekStart = bucketKey(today, "weekly");
  const monthStart = `${bucketKey(today, "monthly")}-01`;
  let since = weekStart < monthStart ? weekStart : monthStart;
  for (const goal of goals) {
    const window = goalWindow(goal);
    if (window && window.start < since) since = window.start;
  }

  const weightGoalExerciseIds = [
    ...new Set(
      goals
        .filter((g) => g.metric === "exercise_weight" && g.exerciseId)
        .map((g) => g.exerciseId as string),
    ),
  ];

  const [{ data: windowWorkouts }, { data: windowSets }, { data: bestRows }] =
    await Promise.all([
      supabase
        .from("workouts")
        .select("date, type, duration_seconds")
        .gte("date", `${since}T00:00:00Z`),
      supabase
        .from("sets")
        .select("weight, reps, workout_exercises!inner(workouts!inner(date))")
        .gte("workout_exercises.workouts.date", `${since}T00:00:00Z`),
      weightGoalExerciseIds.length > 0
        ? supabase
            .from("sets")
            .select("weight, workout_exercises!inner(exercise_id)")
            .in("workout_exercises.exercise_id", weightGoalExerciseIds)
        : Promise.resolve({ data: [] as unknown[] }),
    ]);

  const exerciseBestKg: Record<string, number> = {};
  for (const row of (bestRows ?? []) as unknown as BestSetRow[]) {
    const id = row.workout_exercises.exercise_id;
    exerciseBestKg[id] = Math.max(exerciseBestKg[id] ?? 0, row.weight);
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

      <GoalWizard avgWeeklyVolumeKg={avgWeeklyVolumeKg} unit={unit} />

      <GoalForm exercises={exercises ?? []} unit={unit} />

      <NutritionTargets
        initial={nutritionTargets}
        weightKg={latestWeigh?.weight_kg ?? null}
        heightCm={profile?.height_cm ?? null}
        birthYear={profile?.birth_year ?? null}
        sex={
          profile?.sex === "male" || profile?.sex === "female" ? profile.sex : null
        }
        sessionsPerWeek={sessionsPerWeek}
        currentYear={new Date().getUTCFullYear()}
      />

      {goals.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No goals yet — set your first one above.
        </p>
      ) : (
        <GoalList
          // Remount on create/delete so server order and items stay in sync.
          key={goals.map((g) => g.id).join(",")}
          items={goals.map(({ exerciseName, ...goal }): GoalListItem => {
            const progress = computeGoalProgress(goal, inputs);
            return {
              goal,
              label: goalLabel(goal, exerciseName, unit),
              valueText: `${goalValueLabel(goal, progress.current, unit)} of ${goalValueLabel(goal, progress.target, unit)}${goal.metric === "exercise_weight" ? " (best ever)" : ""}`,
              progress,
            };
          })}
        />
      )}
    </div>
  );
}
