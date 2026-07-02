"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  WORKOUT_TYPES,
  type Exercise,
  type PreviousPerformance,
  type WorkoutType,
} from "@/lib/types";

export async function createExercise(
  name: string,
): Promise<{ data?: Exercise; error?: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Exercise name is required." };
  if (trimmed.length > 100) return { error: "Exercise name is too long." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data, error } = await supabase
    .from("exercises")
    .insert({ user_id: user.id, name: trimmed })
    .select("id, name")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { error: "You already have an exercise with that name." };
    }
    return { error: error.message };
  }
  return { data };
}

// Sets from the most recent past workout that included this exercise,
// shown while logging so the user knows what to beat. RLS scopes to the user.
export async function getPreviousPerformance(
  exerciseId: string,
): Promise<PreviousPerformance | null> {
  const supabase = await createClient();

  const { data: workout } = await supabase
    .from("workouts")
    .select("id, date, workout_exercises!inner(id, notes, exercise_id)")
    .eq("workout_exercises.exercise_id", exerciseId)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const workoutExercise = workout?.workout_exercises?.[0];
  if (!workout || !workoutExercise) return null;

  const { data: sets } = await supabase
    .from("sets")
    .select("set_number, weight, reps")
    .eq("workout_exercise_id", workoutExercise.id)
    .order("set_number");

  return {
    workoutDate: workout.date,
    notes: workoutExercise.notes,
    sets: sets ?? [],
  };
}

export type SetPayload = {
  weightKg: number;
  reps: number;
};

export type ExerciseEntryPayload = {
  exerciseId: string;
  notes: string;
  sets: SetPayload[];
};

export type WorkoutPayload = {
  date: string; // YYYY-MM-DD
  type: WorkoutType;
  exercises: ExerciseEntryPayload[];
};

function validate(payload: WorkoutPayload): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) return "Invalid date.";
  if (!WORKOUT_TYPES.includes(payload.type)) return "Invalid workout type.";
  if (payload.exercises.length === 0) return "Add at least one exercise.";

  for (const entry of payload.exercises) {
    if (!entry.exerciseId) return "Every exercise entry needs an exercise selected.";
    if (entry.sets.length === 0) return "Every exercise needs at least one set.";
    for (const set of entry.sets) {
      if (!Number.isFinite(set.weightKg) || set.weightKg < 0 || set.weightKg > 2000) {
        return "Set weights must be between 0 and your unit's equivalent of 2000 kg.";
      }
      if (!Number.isInteger(set.reps) || set.reps < 1 || set.reps > 1000) {
        return "Reps must be a whole number of at least 1.";
      }
    }
  }
  return null;
}

export async function saveWorkout(
  payload: WorkoutPayload,
): Promise<{ error?: string }> {
  const invalid = validate(payload);
  if (invalid) return { error: invalid };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // Stored at noon UTC so the calendar day doesn't shift across timezones.
  const { data: workout, error: workoutError } = await supabase
    .from("workouts")
    .insert({
      user_id: user.id,
      date: `${payload.date}T12:00:00Z`,
      type: payload.type,
    })
    .select("id")
    .single();

  if (workoutError || !workout) {
    return { error: workoutError?.message ?? "Could not create workout." };
  }

  // No client-side transactions over PostgREST, so on any child insert
  // failure delete the workout — cascades clean up whatever was written.
  const rollback = async (message: string) => {
    await supabase.from("workouts").delete().eq("id", workout.id);
    return { error: message };
  };

  const { data: workoutExercises, error: weError } = await supabase
    .from("workout_exercises")
    .insert(
      payload.exercises.map((entry, index) => ({
        workout_id: workout.id,
        exercise_id: entry.exerciseId,
        notes: entry.notes.trim() || null,
        position: index,
      })),
    )
    .select("id");

  if (weError || !workoutExercises || workoutExercises.length !== payload.exercises.length) {
    return rollback(weError?.message ?? "Could not save exercises.");
  }

  const setRows = payload.exercises.flatMap((entry, index) =>
    entry.sets.map((set, setIndex) => ({
      workout_exercise_id: workoutExercises[index].id,
      set_number: setIndex + 1,
      weight: set.weightKg,
      reps: set.reps,
    })),
  );

  const { error: setsError } = await supabase.from("sets").insert(setRows);
  if (setsError) {
    return rollback(setsError.message);
  }

  revalidatePath("/dashboard");
  return {};
}
