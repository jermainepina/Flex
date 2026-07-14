"use server";

import { revalidatePath } from "next/cache";
import {
  goalLabel,
  goalWindow,
  newlyCompletedGoals,
  type Goal,
  type GoalInputs,
  type GoalMetric,
  type GoalPeriod,
  type WeekAnchor,
} from "@/lib/goals";
import { collectBests, computePrFlags, type ExerciseBests } from "@/lib/pr";
import { createClient } from "@/lib/supabase/server";
import {
  MUSCLE_GROUPS,
  nextDefaultName,
  type Exercise,
  type MuscleGroup,
  type PreviousPerformance,
} from "@/lib/types";
import type { WeightUnit } from "@/lib/units";
import { bucketKey } from "@/lib/volume";

export type CompletedGoal = { id: string; label: string };

type CompletionGoalRow = {
  id: string;
  metric: GoalMetric;
  period: GoalPeriod | null;
  target: number;
  exercise_id: string | null;
  created_at: string;
  week_anchor: WeekAnchor;
  exercises: { name: string } | null;
};

type CompletionSetRow = {
  weight: number;
  reps: number;
  workout_exercises: { workout_id: string; workouts: { date: string } };
};

type CompletionBestRow = {
  weight: number;
  workout_exercises: { workout_id: string; exercise_id: string };
};

/**
 * Goals the just-saved workout pushed over the line: progress is computed
 * with and without the new workout's rows, and only fresh crossings are
 * returned. Fail-soft — a celebration must never block a successful save.
 */
async function findCompletedGoals(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workoutId: string,
): Promise<CompletedGoal[]> {
  try {
    const today = new Date().toISOString().slice(0, 10);

    const [{ data: goalRows, error: goalsError }, { data: profile }] =
      await Promise.all([
        supabase
          .from("goals")
          .select(
            "id, metric, period, target, exercise_id, created_at, week_anchor, exercises(name)",
          ),
        supabase.from("profiles").select("preferred_unit").maybeSingle(),
      ]);
    if (goalsError || !goalRows || goalRows.length === 0) return [];

    const goals = goalRows as unknown as CompletionGoalRow[];
    const unit: WeightUnit = profile?.preferred_unit === "kg" ? "kg" : "lb";

    const goalList: Goal[] = goals.map((g) => ({
      id: g.id,
      metric: g.metric,
      period: g.period,
      target: Number(g.target),
      exerciseId: g.exercise_id,
      createdAt: g.created_at,
      weekAnchor: g.week_anchor ?? "monday",
    }));

    // Fetch far enough back to cover the earliest goal window (goals are
    // one-shot, so windows start at most ~a month ago).
    const weekStart = bucketKey(today, "weekly");
    const monthStart = `${bucketKey(today, "monthly")}-01`;
    let since = weekStart < monthStart ? weekStart : monthStart;
    for (const goal of goalList) {
      const window = goalWindow(goal);
      if (window && window.start < since) since = window.start;
    }

    const [{ data: windowWorkouts }, { data: windowSets }] = await Promise.all([
      supabase
        .from("workouts")
        .select("id, date, type, duration_seconds")
        .gte("date", `${since}T00:00:00Z`),
      supabase
        .from("sets")
        .select(
          "weight, reps, workout_exercises!inner(workout_id, workouts!inner(date))",
        )
        .gte("workout_exercises.workouts.date", `${since}T00:00:00Z`),
    ]);

    // All-time bests per exercise (with/without the new workout), only for
    // exercises referenced by weight goals.
    const weightGoalExerciseIds = [
      ...new Set(
        goals
          .filter((g) => g.metric === "exercise_weight" && g.exercise_id)
          .map((g) => g.exercise_id as string),
      ),
    ];
    const bestAfter: Record<string, number> = {};
    const bestBefore: Record<string, number> = {};
    if (weightGoalExerciseIds.length > 0) {
      const { data: bestRows } = await supabase
        .from("sets")
        .select("weight, workout_exercises!inner(workout_id, exercise_id)")
        .in("workout_exercises.exercise_id", weightGoalExerciseIds);
      for (const row of (bestRows ?? []) as unknown as CompletionBestRow[]) {
        const exId = row.workout_exercises.exercise_id;
        bestAfter[exId] = Math.max(bestAfter[exId] ?? 0, row.weight);
        if (row.workout_exercises.workout_id !== workoutId) {
          bestBefore[exId] = Math.max(bestBefore[exId] ?? 0, row.weight);
        }
      }
    }

    const allWorkouts = windowWorkouts ?? [];
    const allSets = (windowSets ?? []) as unknown as CompletionSetRow[];
    const buildInputs = (excludeWorkoutId: string | null): GoalInputs => {
      const ws = excludeWorkoutId
        ? allWorkouts.filter((w) => w.id !== excludeWorkoutId)
        : allWorkouts;
      const sets = excludeWorkoutId
        ? allSets.filter(
            (s) => s.workout_exercises.workout_id !== excludeWorkoutId,
          )
        : allSets;
      return {
        today,
        workoutDates: ws.map((w) => w.date),
        setRows: sets.map((s) => ({
          date: s.workout_exercises.workouts.date,
          weightKg: s.weight,
          reps: s.reps,
        })),
        cardioRows: ws
          .filter((w) => w.type === "cardio")
          .map((w) => ({ date: w.date, durationSeconds: w.duration_seconds ?? 0 })),
        exerciseBestKg: excludeWorkoutId ? bestBefore : bestAfter,
      };
    };

    const nameById = new Map(goals.map((g) => [g.id, g.exercises?.name ?? null]));

    return newlyCompletedGoals(
      goalList,
      buildInputs(workoutId),
      buildInputs(null),
    ).map((g) => ({
      id: g.id,
      label: goalLabel(g, nameById.get(g.id) ?? null, unit),
    }));
  } catch {
    return [];
  }
}

export async function createExercise(
  name: string,
  muscleGroup: MuscleGroup,
): Promise<{ data?: Exercise; error?: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Exercise name is required." };
  if (trimmed.length > 100) return { error: "Exercise name is too long." };
  if (!MUSCLE_GROUPS.includes(muscleGroup)) {
    return { error: "Invalid muscle group." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data, error } = await supabase
    .from("exercises")
    .insert({ user_id: user.id, name: trimmed, muscle_group: muscleGroup })
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

// Historical bests for one exercise — feeds the live gold-PR highlight in the
// logger and the authoritative is_pr computation in saveWorkout.
export async function getExerciseBests(
  exerciseId: string,
): Promise<ExerciseBests> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sets")
    .select("weight, reps, workout_exercises!inner(exercise_id)")
    .eq("workout_exercises.exercise_id", exerciseId);
  return collectBests(
    (data ?? []).map((r) => ({ weightKg: r.weight, reps: r.reps })),
  );
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
  name: string; // blank -> auto-numbered "Workout N"
  durationSeconds: number;
  templateId?: string | null;
  exercises: ExerciseEntryPayload[];
};

function validate(payload: WorkoutPayload): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) return "Invalid date.";
  if (payload.name.trim().length > 100) return "Workout name is too long.";
  if (
    !Number.isFinite(payload.durationSeconds) ||
    payload.durationSeconds < 0 ||
    payload.durationSeconds > 24 * 3600
  ) {
    return "Invalid workout duration.";
  }
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

export type CardioPayload = {
  date: string; // YYYY-MM-DD
  name: string; // blank -> "Cardio"
  durationSeconds: number;
};

/**
 * Save a cardio session: a workout with type='cardio', a duration, and no
 * exercises/sets. The name (defaulting to the chosen cardio kind) is how the
 * session shows up in history/calendar.
 */
export async function saveCardio(
  payload: CardioPayload,
): Promise<{
  workoutId?: string;
  error?: string;
  completedGoals?: CompletedGoal[];
}> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) return { error: "Invalid date." };
  if (payload.name.trim().length > 100) return { error: "Name is too long." };
  if (
    !Number.isFinite(payload.durationSeconds) ||
    payload.durationSeconds < 1 ||
    payload.durationSeconds > 24 * 3600
  ) {
    return { error: "Invalid session duration." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // Stored at noon UTC so the calendar day doesn't shift across timezones.
  const { data: workout, error } = await supabase
    .from("workouts")
    .insert({
      user_id: user.id,
      date: `${payload.date}T12:00:00Z`,
      name: payload.name.trim() || "Cardio",
      type: "cardio",
      duration_seconds: Math.round(payload.durationSeconds),
    })
    .select("id")
    .single();

  if (error || !workout) {
    return { error: error?.message ?? "Could not save cardio session." };
  }

  const completedGoals = await findCompletedGoals(supabase, workout.id);
  revalidatePath("/dashboard");
  return { workoutId: workout.id, completedGoals };
}

export async function saveWorkout(
  payload: WorkoutPayload,
): Promise<{
  workoutId?: string;
  error?: string;
  completedGoals?: CompletedGoal[];
}> {
  const invalid = validate(payload);
  if (invalid) return { error: invalid };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // PR flags are computed against history BEFORE this workout is inserted.
  const bestsPerEntry = await Promise.all(
    payload.exercises.map((entry) => getExerciseBests(entry.exerciseId)),
  );

  // Record which template started this workout — only if it's really the
  // user's (RLS-scoped fetch); otherwise drop it silently.
  let templateId: string | null = null;
  if (payload.templateId) {
    const { data: tpl } = await supabase
      .from("templates")
      .select("id")
      .eq("id", payload.templateId)
      .maybeSingle();
    templateId = tpl?.id ?? null;
  }

  // Blank name -> smallest untaken "Workout N" among this user's workouts.
  let name = payload.name.trim();
  if (!name) {
    const { data: named } = await supabase
      .from("workouts")
      .select("name")
      .ilike("name", "workout %");
    name = nextDefaultName((named ?? []).map((r) => r.name ?? ""));
  }

  // Stored at noon UTC so the calendar day doesn't shift across timezones.
  const { data: workout, error: workoutError } = await supabase
    .from("workouts")
    .insert({
      user_id: user.id,
      date: `${payload.date}T12:00:00Z`,
      name,
      duration_seconds: Math.round(payload.durationSeconds),
      template_id: templateId,
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

  const setRows = payload.exercises.flatMap((entry, index) => {
    const prFlags = computePrFlags(entry.sets, bestsPerEntry[index]);
    return entry.sets.map((set, setIndex) => ({
      workout_exercise_id: workoutExercises[index].id,
      set_number: setIndex + 1,
      weight: set.weightKg,
      reps: set.reps,
      is_pr: prFlags[setIndex],
    }));
  });

  const { error: setsError } = await supabase.from("sets").insert(setRows);
  if (setsError) {
    return rollback(setsError.message);
  }

  const completedGoals = await findCompletedGoals(supabase, workout.id);
  revalidatePath("/dashboard");
  return { workoutId: workout.id, completedGoals };
}
