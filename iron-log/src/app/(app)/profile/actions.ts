"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ProfilePayload = {
  heightCm: number | null;
  birthYear: number | null;
  sex: "male" | "female" | null;
  /** Display-unit-converted kg; saving creates/updates today's weigh-in. */
  weightKg: number | null;
};

export async function updateProfile(
  payload: ProfilePayload,
): Promise<{ error?: string }> {
  if (
    payload.heightCm !== null &&
    (!Number.isFinite(payload.heightCm) || payload.heightCm < 50 || payload.heightCm > 275)
  ) {
    return { error: "Height looks off — enter it again." };
  }
  if (
    payload.birthYear !== null &&
    (!Number.isInteger(payload.birthYear) ||
      payload.birthYear < 1900 ||
      payload.birthYear > 2100)
  ) {
    return { error: "Birth year looks off." };
  }
  if (payload.sex !== null && payload.sex !== "male" && payload.sex !== "female") {
    return { error: "Invalid selection." };
  }
  if (
    payload.weightKg !== null &&
    (!Number.isFinite(payload.weightKg) || payload.weightKg <= 0 || payload.weightKg > 500)
  ) {
    return { error: "Weight looks off — enter it again." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase
    .from("profiles")
    .update({
      height_cm: payload.heightCm,
      birth_year: payload.birthYear,
      sex: payload.sex,
    })
    .eq("id", user.id);
  if (error) return { error: error.message };

  // Weight is never stored on the profile — it's today's weigh-in (the
  // body_weight_logs table is the single source of truth).
  if (payload.weightKg !== null) {
    const today = new Date().toISOString().slice(0, 10);
    const { error: weighError } = await supabase.from("body_weight_logs").upsert({
      user_id: user.id,
      date: today,
      weight_kg: payload.weightKg,
    });
    if (weighError) return { error: weighError.message };
  }

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return {};
}
