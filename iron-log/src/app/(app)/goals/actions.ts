"use server";

import { revalidatePath } from "next/cache";
import type { GoalMetric, GoalPeriod } from "@/lib/goals";
import { createClient } from "@/lib/supabase/server";

const METRICS: GoalMetric[] = ["sessions", "volume", "exercise_weight", "cardio_minutes"];
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type GoalPayload = {
  metric: GoalMetric;
  period: GoalPeriod | null; // null only for exercise_weight
  target: number; // canonical: count / kg / minutes
  exerciseId: string | null;
};

export async function createGoal(
  payload: GoalPayload,
): Promise<{ error?: string }> {
  if (!METRICS.includes(payload.metric)) return { error: "Invalid goal type." };
  if (!Number.isFinite(payload.target) || payload.target <= 0) {
    return { error: "Target must be a positive number." };
  }
  if (payload.target > 10_000_000) return { error: "Target is unrealistically large." };
  if (payload.metric === "exercise_weight") {
    if (!payload.exerciseId || !UUID_RE.test(payload.exerciseId)) {
      return { error: "Pick an exercise for a weight goal." };
    }
  } else if (payload.period !== "weekly" && payload.period !== "monthly") {
    return { error: "Pick weekly or monthly." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase.from("goals").insert({
    user_id: user.id,
    metric: payload.metric,
    period: payload.metric === "exercise_weight" ? null : payload.period,
    target: payload.target,
    exercise_id: payload.metric === "exercise_weight" ? payload.exerciseId : null,
  });
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
