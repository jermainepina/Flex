"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { THEMES, type Theme } from "@/lib/types";

export type SettingsPayload = {
  displayName: string;
  theme: Theme;
  preferredUnit: "lb" | "kg";
};

export async function updateSettings(
  payload: SettingsPayload,
): Promise<{ error?: string }> {
  if (payload.displayName.trim().length > 50) {
    return { error: "Name is too long (50 characters max)." };
  }
  if (!THEMES.includes(payload.theme)) return { error: "Invalid theme." };
  if (!["lb", "kg"].includes(payload.preferredUnit)) {
    return { error: "Invalid unit." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: payload.displayName.trim() || null,
      theme: payload.theme,
      preferred_unit: payload.preferredUnit,
    })
    .eq("id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return {};
}
