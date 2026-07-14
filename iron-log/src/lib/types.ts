export const WORKOUT_TYPES = [
  "push",
  "pull",
  "legs",
  "upper",
  "lower",
  "full_body",
  "cardio",
  "other",
] as const;

export type WorkoutType = (typeof WORKOUT_TYPES)[number];

export const WORKOUT_TYPE_LABELS: Record<WorkoutType, string> = {
  push: "Push",
  pull: "Pull",
  legs: "Legs",
  upper: "Upper",
  lower: "Lower",
  full_body: "Full body",
  cardio: "Cardio",
  other: "Other",
};

/**
 * Workouts are labeled by their free-text name; rows from before the name
 * column existed fall back to their legacy type label.
 */
export function workoutDisplayName(
  name: string | null,
  type: WorkoutType | null,
): string {
  if (name?.trim()) return name.trim();
  if (type && type in WORKOUT_TYPE_LABELS) return WORKOUT_TYPE_LABELS[type];
  return "Workout";
}

/**
 * Auto-name for a workout saved without a name: the smallest untaken
 * "Workout N" among the user's existing workout names (case-insensitive).
 */
export function nextDefaultName(existing: string[]): string {
  const taken = new Set<number>();
  for (const name of existing) {
    const m = /^workout (\d+)$/i.exec(name.trim());
    if (m) taken.add(Number(m[1]));
  }
  let n = 1;
  while (taken.has(n)) n++;
  return `Workout ${n}`;
}

// Fixed chart order — each group keeps its palette slot regardless of which
// groups have data (color follows the entity, never its rank).
export const MUSCLE_GROUPS = [
  "chest",
  "back",
  "shoulders",
  "arms",
  "legs",
  "core",
  "other",
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  arms: "Arms",
  legs: "Legs",
  core: "Core",
  other: "Other",
};

// Keyword guess used to default the picker when creating an exercise.
// Mirrors the SQL backfill in supabase/migrations/0002_muscle_groups.sql —
// keep the patterns and their order in sync.
const MUSCLE_GROUP_PATTERNS: [MuscleGroup, RegExp][] = [
  ["legs", /squat|leg|lunge|calf|ham|quad|glute|rdl|romanian|hip thrust/i],
  ["chest", /bench|chest|pec|fly|flye|incline|dip|push.?up/i],
  ["shoulders", /overhead|ohp|shoulder|lateral|delt|face pull/i],
  ["back", /row|pull.?up|pulldown|pull.?down|deadlift|lat |lats|chin/i],
  ["arms", /curl|bicep|tricep|pushdown|push.?down|skull/i],
  ["core", /abs?$|abs? |crunch|plank|sit.?up|core/i],
];

export function guessMuscleGroup(name: string): MuscleGroup {
  for (const [group, pattern] of MUSCLE_GROUP_PATTERNS) {
    if (pattern.test(name)) return group;
  }
  return "other";
}

// Cardio kinds are presentation-only: the chosen kind becomes the workout's
// default name (workouts.type = 'cardio' marks the session itself).
export const CARDIO_KINDS = [
  "Running",
  "Treadmill",
  "Stairmaster",
  "Cycling",
  "Rowing",
  "Elliptical",
  "Swimming",
  "Other cardio",
] as const;

export const THEMES = ["light", "dim", "dark"] as const;
export type Theme = (typeof THEMES)[number];

/**
 * Stable accent color for a workout name: hashes the name onto the seven
 * validated chart slots, so "Push Day" is always the same color everywhere.
 */
export function nameColorVar(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (Math.imul(hash, 31) + name.charCodeAt(i)) | 0;
  }
  return `var(--chart-${(Math.abs(hash) % 7) + 1})`;
}

export type Exercise = {
  id: string;
  name: string;
};

export type PreviousPerformance = {
  workoutDate: string;
  notes: string | null;
  sets: { set_number: number; weight: number; reps: number }[]; // weight in kg
};
