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

export const WORKOUT_TYPE_EMOJI: Record<WorkoutType, string> = {
  push: "💪",
  pull: "🧗",
  legs: "🦵",
  upper: "🔼",
  lower: "🔽",
  full_body: "🏋️",
  cardio: "🏃",
  other: "⭐",
};

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

export type Exercise = {
  id: string;
  name: string;
};

export type PreviousPerformance = {
  workoutDate: string;
  notes: string | null;
  sets: { set_number: number; weight: number; reps: number }[]; // weight in kg
};
