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

  const { error } = await supabase.from("goals").insert(toRow(payload, user.id));
  if (error) return { error: error.message };

  revalidatePath("/goals");
  revalidatePath("/dashboard");
  return {};
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

  const { error } = await supabase
    .from("goals")
    .insert(payloads.map((p) => toRow(p, user.id)));
  if (error) return { error: error.message };

  revalidatePath("/goals");
  revalidatePath("/dashboard");
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
