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

export type Exercise = {
  id: string;
  name: string;
};

export type PreviousPerformance = {
  workoutDate: string;
  notes: string | null;
  sets: { set_number: number; weight: number; reps: number }[]; // weight in kg
};
