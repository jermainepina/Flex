"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type FoodEntryPayload = {
  date: string; // YYYY-MM-DD
  name: string; // optional, "" = unnamed
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  sugarG: number;
};

const validMacro = (n: number) => Number.isFinite(n) && n >= 0 && n <= 100_000;

export async function addFoodEntry(
  payload: FoodEntryPayload,
): Promise<{ error?: string }> {
  if (!DATE_RE.test(payload.date)) return { error: "Invalid date." };
  if (payload.name.trim().length > 100) return { error: "Name is too long." };
  const macros = [
    payload.calories,
    payload.proteinG,
    payload.carbsG,
    payload.fatG,
    payload.sugarG,
  ];
  if (!macros.every(validMacro)) {
    return { error: "Macros must be zero or positive numbers." };
  }
  if (macros.every((m) => m === 0)) {
    return { error: "Enter at least one macro value." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase.from("food_logs").insert({
    user_id: user.id,
    date: payload.date,
    name: payload.name.trim() || null,
    calories: payload.calories,
    protein_g: payload.proteinG,
    carbs_g: payload.carbsG,
    fat_g: payload.fatG,
    sugar_g: payload.sugarG,
  });
  if (error) return { error: error.message };

  revalidatePath("/log/food");
  revalidatePath("/dashboard");
  return {};
}

export async function deleteFoodEntry(id: string): Promise<{ error?: string }> {
  if (!UUID_RE.test(id)) return { error: "Invalid entry." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase.from("food_logs").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/log/food");
  revalidatePath("/dashboard");
  return {};
}

export async function logBodyWeight(payload: {
  date: string;
  weightKg: number;
}): Promise<{ error?: string }> {
  if (!DATE_RE.test(payload.date)) return { error: "Invalid date." };
  if (
    !Number.isFinite(payload.weightKg) ||
    payload.weightKg <= 0 ||
    payload.weightKg > 500
  ) {
    return { error: "Weight looks off — enter it again." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase.from("body_weight_logs").upsert({
    user_id: user.id,
    date: payload.date,
    weight_kg: payload.weightKg,
  });
  if (error) return { error: error.message };

  revalidatePath("/log/food");
  revalidatePath("/profile");
  return {};
}
