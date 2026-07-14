// Pure goal-progress math — no Supabase or React imports so it stays
// unit-testable (run standalone via `node --experimental-strip-types`, hence
// the .ts-extension relative imports, same as the volume fixtures).
//
// Targets are canonical: session counts as-is, weights/volume in kg, cardio
// in minutes. UI converts kg values with kgToUnit at the edge.

import { kgToUnit, unitToKg, type WeightUnit } from "./units.ts";
import { bucketKey } from "./volume.ts";

export type GoalMetric = "sessions" | "volume" | "exercise_weight" | "cardio_minutes";
export type GoalPeriod = "weekly" | "monthly";
export type WeekAnchor = "monday" | "rolling";

export type Goal = {
  id: string;
  metric: GoalMetric;
  period: GoalPeriod | null; // null = standing goal (exercise_weight)
  target: number; // canonical: count / kg / minutes
  exerciseId: string | null;
  createdAt: string; // ISO — anchors the goal's one-shot window
  weekAnchor: WeekAnchor; // weekly goals only; ignored otherwise
};

export type GoalInputs = {
  today: string; // YYYY-MM-DD
  /** Dates (ISO) of workouts covering every active goal's window. */
  workoutDates: string[];
  /** Set rows covering every active goal's window, for volume goals. */
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
  /** The goal's window has ended (always false for standing goals). */
  expired: boolean;
  /** Window ended without hitting the target — auto-deleted by the UI. */
  missed: boolean;
};

function addDays(iso: string, days: number) {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * A goal's one-shot measurement window [start, end), anchored at creation:
 * weekly+monday = the calendar week containing createdAt; weekly+rolling =
 * 7 days from creation; monthly = the calendar month of creation. Standing
 * (exercise_weight) goals have no window.
 */
export function goalWindow(goal: Goal): { start: string; end: string } | null {
  if (!goal.period) return null;
  const created = goal.createdAt.slice(0, 10);
  if (goal.period === "weekly") {
    const start = goal.weekAnchor === "rolling" ? created : bucketKey(created, "weekly");
    return { start, end: addDays(start, 7) };
  }
  const monthStart = `${created.slice(0, 7)}-01`;
  const [y, m] = created.split("-").map(Number);
  const nextMonth = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  return { start: monthStart, end: nextMonth };
}

export function computeGoalProgress(goal: Goal, inputs: GoalInputs): GoalProgress {
  const window = goalWindow(goal);
  const inWindow = (date: string) => {
    if (!window) return true;
    const day = date.slice(0, 10);
    return day >= window.start && day < window.end;
  };

  let current = 0;
  if (goal.metric === "sessions" && goal.period) {
    const days = new Set(
      inputs.workoutDates.map((d) => d.slice(0, 10)).filter(inWindow),
    );
    current = days.size;
  } else if (goal.metric === "volume" && goal.period) {
    for (const r of inputs.setRows) {
      if (inWindow(r.date)) current += r.weightKg * r.reps;
    }
  } else if (goal.metric === "cardio_minutes" && goal.period) {
    for (const r of inputs.cardioRows) {
      if (inWindow(r.date)) current += r.durationSeconds / 60;
    }
    current = Math.round(current);
  } else if (goal.metric === "exercise_weight" && goal.exerciseId) {
    current = inputs.exerciseBestKg[goal.exerciseId] ?? 0;
  }

  const pct = goal.target > 0 ? Math.max(0, Math.min(1, current / goal.target)) : 0;
  const achieved = current >= goal.target;
  const expired = window !== null && inputs.today >= window.end;
  return {
    current,
    target: goal.target,
    pct,
    achieved,
    expired,
    missed: expired && !achieved,
  };
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

// ---------------------------------------------------------------------------
// "Help me choose" — deterministic rule-based goal suggestions (no AI).

export type WizardAnswers = {
  frequency: "2-3" | "3-4" | "5-6"; // desired training days per week
  objective: "cut" | "bulk" | "maintain" | "strength" | "fitness";
  cardio: "none" | "light" | "regular";
};

export type SuggestedGoal = {
  metric: GoalMetric;
  period: GoalPeriod;
  target: number; // canonical: count / kg / minutes
  reason: string;
};

const FREQUENCY_SESSIONS: Record<WizardAnswers["frequency"], number> = {
  "2-3": 3,
  "3-4": 4,
  "5-6": 5,
};

const VOLUME_FACTOR: Record<WizardAnswers["objective"], number> = {
  bulk: 1.15,
  strength: 1.1,
  maintain: 1.0,
  fitness: 1.0,
  cut: 0.9,
};

const VOLUME_REASON: Record<WizardAnswers["objective"], string> = {
  bulk: "≈15% above your recent weekly volume to drive growth",
  strength: "≈10% above your recent weekly volume for progressive overload",
  maintain: "matches your recent weekly volume",
  fitness: "matches your recent weekly volume",
  cut: "≈10% below your recent volume — keep lifting while cutting",
};

/** Round a display-unit number to a clean step (500 lb / 250 kg). */
function roundVolumeDisplay(value: number, unit: WeightUnit): number {
  const step = unit === "kg" ? 250 : 500;
  return Math.max(step, Math.round(value / step) * step);
}

/**
 * Suggest 3–5 weekly/monthly goals from the questionnaire, anchored to the
 * user's actual recent volume where history exists (no invented numbers —
 * without history the volume suggestion is skipped).
 */
export function suggestGoals(
  answers: WizardAnswers,
  context: { avgWeeklyVolumeKg: number | null; unit: WeightUnit },
): SuggestedGoal[] {
  const out: SuggestedGoal[] = [];
  const sessions = FREQUENCY_SESSIONS[answers.frequency];

  out.push({
    metric: "sessions",
    period: "weekly",
    target: sessions,
    reason: `you said ${answers.frequency} days a week — aim for ${sessions}`,
  });
  out.push({
    metric: "sessions",
    period: "monthly",
    target: sessions * 4,
    reason: "the same pace held for a full month",
  });

  if (context.avgWeeklyVolumeKg !== null && context.avgWeeklyVolumeKg > 0) {
    const scaledDisplay = kgToUnit(
      context.avgWeeklyVolumeKg * VOLUME_FACTOR[answers.objective],
      context.unit,
    );
    out.push({
      metric: "volume",
      period: "weekly",
      target: unitToKg(roundVolumeDisplay(scaledDisplay, context.unit), context.unit),
      reason: VOLUME_REASON[answers.objective],
    });
  }

  let cardioMin = 0;
  let cardioReason = "";
  if (answers.cardio === "light") {
    cardioMin = 30;
    cardioReason = "a little cardio each week";
  } else if (answers.cardio === "regular") {
    cardioMin = 60;
    cardioReason = "regular weekly cardio";
  }
  if (answers.objective === "cut" && cardioMin < 90) {
    cardioMin = 90;
    cardioReason = "extra cardio supports a cut";
  } else if (answers.objective === "fitness" && cardioMin < 60) {
    cardioMin = 60;
    cardioReason = "steady cardio for general fitness";
  }
  if (cardioMin > 0) {
    out.push({
      metric: "cardio_minutes",
      period: "weekly",
      target: cardioMin,
      reason: cardioReason,
    });
  }

  return out;
}

const fmt = (n: number) =>
  Math.round(n) === n ? n.toLocaleString("en-US") : (Math.round(n * 10) / 10).toLocaleString("en-US");

/** "week", "7 days", or "month" — rolling weekly goals read differently. */
function perLabelFor(goal: Pick<Goal, "period" | "weekAnchor">): string {
  if (goal.period === "monthly") return "month";
  return goal.weekAnchor === "rolling" ? "7 days" : "week";
}

/** Short human label for a goal, e.g. "4 sessions / week", "Bench Press · 225 lb". */
export function goalLabel(
  goal: Goal,
  exerciseName: string | null,
  unit: WeightUnit,
): string {
  switch (goal.metric) {
    case "sessions":
      return `${fmt(goal.target)} session${goal.target === 1 ? "" : "s"} / ${perLabelFor(goal)}`;
    case "volume":
      return `${fmt(Math.round(kgToUnit(goal.target, unit)))} ${unit} volume / ${perLabelFor(goal)}`;
    case "cardio_minutes":
      return `${fmt(goal.target)} min cardio / ${perLabelFor(goal)}`;
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
