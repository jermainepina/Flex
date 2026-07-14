// Pure goal-progress math — no Supabase or React imports so it stays
// unit-testable (run standalone via `node --experimental-strip-types`, hence
// the .ts-extension relative imports, same as the volume fixtures).
//
// Targets are canonical: session counts as-is, weights/volume in kg, cardio
// in minutes. UI converts kg values with kgToUnit at the edge.

import { kgToUnit, type WeightUnit } from "./units.ts";
import { bucketKey } from "./volume.ts";

export type GoalMetric = "sessions" | "volume" | "exercise_weight" | "cardio_minutes";
export type GoalPeriod = "weekly" | "monthly";

export type Goal = {
  id: string;
  metric: GoalMetric;
  period: GoalPeriod | null; // null = standing goal (exercise_weight)
  target: number; // canonical: count / kg / minutes
  exerciseId: string | null;
};

export type GoalInputs = {
  today: string; // YYYY-MM-DD
  /** Dates (ISO) of all workouts in the current period window. */
  workoutDates: string[];
  /** Set rows in the current period window, for volume goals. */
  setRows: { date: string; weightKg: number; reps: number }[];
  /** Cardio workouts (type='cardio') in the window, for cardio goals. */
  cardioRows: { date: string; durationSeconds: number }[];
  /** Heaviest set ever per exercise id, for standing weight goals. */
  exerciseBestKg: Record<string, number>;
};

export type GoalProgress = {
  current: number; // canonical units, same as target
  target: number;
  pct: number; // 0..1, clamped
  achieved: boolean;
};

const granularity = (period: GoalPeriod) =>
  period === "weekly" ? ("weekly" as const) : ("monthly" as const);

/** Bucket key for "the current week/month" the goal is measured against. */
export function currentBucket(today: string, period: GoalPeriod): string {
  return bucketKey(today, granularity(period));
}

function inCurrentBucket(date: string, today: string, period: GoalPeriod) {
  return (
    bucketKey(date.slice(0, 10), granularity(period)) ===
    currentBucket(today, period)
  );
}

export function computeGoalProgress(goal: Goal, inputs: GoalInputs): GoalProgress {
  let current = 0;

  if (goal.metric === "sessions" && goal.period) {
    const days = new Set(
      inputs.workoutDates
        .map((d) => d.slice(0, 10))
        .filter((d) => inCurrentBucket(d, inputs.today, goal.period!)),
    );
    current = days.size;
  } else if (goal.metric === "volume" && goal.period) {
    for (const r of inputs.setRows) {
      if (inCurrentBucket(r.date, inputs.today, goal.period)) {
        current += r.weightKg * r.reps;
      }
    }
  } else if (goal.metric === "cardio_minutes" && goal.period) {
    for (const r of inputs.cardioRows) {
      if (inCurrentBucket(r.date, inputs.today, goal.period)) {
        current += r.durationSeconds / 60;
      }
    }
    current = Math.round(current);
  } else if (goal.metric === "exercise_weight" && goal.exerciseId) {
    current = inputs.exerciseBestKg[goal.exerciseId] ?? 0;
  }

  const pct = goal.target > 0 ? Math.max(0, Math.min(1, current / goal.target)) : 0;
  return { current, target: goal.target, pct, achieved: current >= goal.target };
}

/**
 * Goals that a just-saved workout pushed over the line: achieved with the new
 * data (`after`) but not without it (`before`). Already-achieved goals don't
 * re-fire.
 */
export function newlyCompletedGoals(
  goals: Goal[],
  before: GoalInputs,
  after: GoalInputs,
): Goal[] {
  return goals.filter(
    (g) =>
      computeGoalProgress(g, after).achieved &&
      !computeGoalProgress(g, before).achieved,
  );
}

const perLabel = (period: GoalPeriod) => (period === "weekly" ? "week" : "month");

const fmt = (n: number) =>
  Math.round(n) === n ? n.toLocaleString("en-US") : (Math.round(n * 10) / 10).toLocaleString("en-US");

/** Short human label for a goal, e.g. "4 sessions / week", "Bench Press · 225 lb". */
export function goalLabel(
  goal: Goal,
  exerciseName: string | null,
  unit: WeightUnit,
): string {
  switch (goal.metric) {
    case "sessions":
      return `${fmt(goal.target)} session${goal.target === 1 ? "" : "s"} / ${perLabel(goal.period ?? "weekly")}`;
    case "volume":
      return `${fmt(Math.round(kgToUnit(goal.target, unit)))} ${unit} volume / ${perLabel(goal.period ?? "weekly")}`;
    case "cardio_minutes":
      return `${fmt(goal.target)} min cardio / ${perLabel(goal.period ?? "weekly")}`;
    case "exercise_weight":
      return `${exerciseName ?? "Exercise"} · ${fmt(Math.round(kgToUnit(goal.target, unit) * 10) / 10)} ${unit}`;
  }
}

/** "current / target" pair formatted in display units for one goal. */
export function goalValueLabel(goal: Goal, value: number, unit: WeightUnit): string {
  switch (goal.metric) {
    case "sessions":
      return fmt(value);
    case "cardio_minutes":
      return `${fmt(value)} min`;
    case "volume":
      return `${fmt(Math.round(kgToUnit(value, unit)))} ${unit}`;
    case "exercise_weight":
      return `${fmt(Math.round(kgToUnit(value, unit) * 10) / 10)} ${unit}`;
  }
}
