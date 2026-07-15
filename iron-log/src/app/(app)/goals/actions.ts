"use server";

import { revalidatePath } from "next/cache";
import type { GoalMetric, GoalPeriod, WeekAnchor } from "@/lib/goals";
import { createClient } from "@/lib/supabase/server";

const METRICS: GoalMetric[] = ["sessions", "volume", "exercise_weight", "cardio_minutes"];
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type GoalPayload = {
  metric: GoalMetric;
  period: GoalPeriod | null; // null only for exercise_weight
  target: number; // canonical: count / kg / minutes
  exerciseId: string | null;
  weekAnchor?: WeekAnchor; // weekly goals only; defaults to 'monday'
};

function validateGoalPayload(payload: GoalPayload): string | null {
  if (!METRICS.includes(payload.metric)) return "Invalid goal type.";
  if (!Number.isFinite(payload.target) || payload.target <= 0) {
    return "Target must be a positive number.";
  }
  if (payload.target > 10_000_000) return "Target is unrealistically large.";
  if (payload.metric === "exercise_weight") {
    if (!payload.exerciseId || !UUID_RE.test(payload.exerciseId)) {
      return "Pick an exercise for a weight goal.";
    }
  } else if (payload.period !== "weekly" && payload.period !== "monthly") {
    return "Pick weekly or monthly.";
  }
  if (
    payload.weekAnchor !== undefined &&
    payload.weekAnchor !== "monday" &&
    payload.weekAnchor !== "rolling"
  ) {
    return "Invalid weekly window.";
  }
  return null;
}

// Uniform keys on every row — PostgREST rejects mixed-key bulk inserts.
function toRow(payload: GoalPayload, userId: string) {
  return {
    user_id: userId,
    metric: payload.metric,
    period: payload.metric === "exercise_weight" ? null : payload.period,
    target: payload.target,
    exercise_id: payload.metric === "exercise_weight" ? payload.exerciseId : null,
    week_anchor: payload.period === "weekly" ? (payload.weekAnchor ?? "monday") : "monday",
  };
}

export async function createGoal(
  payload: GoalPayload,
): Promise<{ error?: string }> {
  const invalid = validateGoalPayload(payload);
  if (invalid) return { error: invalid };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const nextPosition = await maxPosition(supabase);
  const { error } = await supabase
    .from("goals")
    .insert({ ...toRow(payload, user.id), position: nextPosition });
  if (error) return { error: error.message };

  revalidatePath("/goals");
  revalidatePath("/dashboard");
  return {};
}

/** New goals rank after everything the user already ordered. */
async function maxPosition(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<number> {
  const { data } = await supabase
    .from("goals")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.position ?? -1) + 1;
}

/** Bulk add — used by the "Help me choose" wizard's approved suggestions. */
export async function createGoals(
  payloads: GoalPayload[],
): Promise<{ error?: string }> {
  if (payloads.length === 0) return { error: "Nothing selected." };
  if (payloads.length > 10) return { error: "Too many goals at once." };
  for (const payload of payloads) {
    const invalid = validateGoalPayload(payload);
    if (invalid) return { error: invalid };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const nextPosition = await maxPosition(supabase);
  const { error } = await supabase
    .from("goals")
    .insert(
      payloads.map((p, i) => ({ ...toRow(p, user.id), position: nextPosition + i })),
    );
  if (error) return { error: error.message };

  revalidatePath("/goals");
  revalidatePath("/dashboard");
  return {};
}

/** Persist a drag-and-drop ranking: ids in importance order (0 = top). */
export async function reorderGoals(ids: string[]): Promise<{ error?: string }> {
  if (ids.length === 0 || ids.length > 100 || !ids.every((id) => UUID_RE.test(id))) {
    return { error: "Invalid order." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // Few rows, RLS-scoped — parallel updates are fine here.
  const results = await Promise.all(
    ids.map((id, index) =>
      supabase.from("goals").update({ position: index }).eq("id", id),
    ),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return { error: failed.error.message };

  revalidatePath("/goals");
  revalidatePath("/dashboard");
  return {};
}

export type NutritionGoalsPayload = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  sugarG: number;
};

/** Upsert the user's single daily nutrition-targets row. */
export async function saveNutritionGoals(
  payload: NutritionGoalsPayload,
): Promise<{ error?: string }> {
  const values = [
    payload.calories,
    payload.proteinG,
    payload.carbsG,
    payload.fatG,
    payload.sugarG,
  ];
  if (!values.every((v) => Number.isFinite(v) && v >= 0 && v <= 100_000)) {
    return { error: "Targets must be zero or positive numbers." };
  }
  if (payload.calories <= 0) return { error: "Calories must be above zero." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase.from("nutrition_goals").upsert({
    user_id: user.id,
    calories: Math.round(payload.calories),
    protein_g: Math.round(payload.proteinG),
    carbs_g: Math.round(payload.carbsG),
    fat_g: Math.round(payload.fatG),
    sugar_g: Math.round(payload.sugarG),
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: error.message };

  revalidatePath("/goals");
  revalidatePath("/dashboard");
  revalidatePath("/log/food");
  return {};
}

export async function deleteGoal(id: string): Promise<{ error?: string }> {
  if (!UUID_RE.test(id)) return { error: "Invalid goal." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase.from("goals").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/goals");
  revalidatePath("/dashboard");
  return {};
}
