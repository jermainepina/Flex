"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type TemplateEntryPayload = {
  exerciseId: string;
  sets: number;
  notes: string;
  weightsKg: (number | null)[]; // per set; null = no suggested weight
};

export type TemplatePayload = {
  id?: string;
  name: string;
  exercises: TemplateEntryPayload[];
};

function validate(payload: TemplatePayload): string | null {
  if (!payload.name.trim()) return "Template name is required.";
  if (payload.name.trim().length > 100) return "Template name is too long.";
  if (payload.exercises.length === 0) return "Add at least one exercise.";
  if (payload.exercises.length > 50) return "Too many exercises.";
  for (const entry of payload.exercises) {
    if (!entry.exerciseId) return "Every row needs an exercise selected.";
    if (!Number.isInteger(entry.sets) || entry.sets < 1 || entry.sets > 20) {
      return "Sets must be a whole number between 1 and 20.";
    }
    if (entry.notes.length > 500) return "Exercise notes are too long.";
    for (const w of entry.weightsKg) {
      if (w !== null && (!Number.isFinite(w) || w < 0 || w > 2000)) {
        return "Suggested weights must be between 0 and your unit's equivalent of 2000 kg.";
      }
    }
  }
  return null;
}

export async function saveTemplate(
  payload: TemplatePayload,
): Promise<{ templateId?: string; error?: string }> {
  const invalid = validate(payload);
  if (invalid) return { error: invalid };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  let templateId = payload.id;
  if (templateId) {
    const { data, error } = await supabase
      .from("templates")
      .update({ name: payload.name.trim() })
      .eq("id", templateId)
      .select("id")
      .maybeSingle();
    if (error) return { error: error.message };
    if (!data) return { error: "Template not found." };
    // Replace the exercise list wholesale — simplest way to persist reorders.
    const { error: delError } = await supabase
      .from("template_exercises")
      .delete()
      .eq("template_id", templateId);
    if (delError) return { error: delError.message };
  } else {
    const { data, error } = await supabase
      .from("templates")
      .insert({ user_id: user.id, name: payload.name.trim() })
      .select("id")
      .single();
    if (error || !data) return { error: error?.message ?? "Could not create template." };
    templateId = data.id;
  }

  const { error: insError } = await supabase.from("template_exercises").insert(
    payload.exercises.map((entry, index) => {
      // Align to the sets count: pad missing with null, drop extras.
      const weights = Array.from(
        { length: entry.sets },
        (_, i) => entry.weightsKg[i] ?? null,
      );
      return {
        template_id: templateId,
        exercise_id: entry.exerciseId,
        position: index,
        target_sets: entry.sets,
        notes: entry.notes.trim() || null,
        target_weights: weights.every((w) => w === null) ? null : weights,
      };
    }),
  );
  if (insError) {
    if (!payload.id) {
      // Fresh template whose children failed — remove the orphan shell.
      await supabase.from("templates").delete().eq("id", templateId);
    }
    return { error: insError.message };
  }

  revalidatePath("/templates");
  return { templateId };
}

// Used directly as a <form action> (must return void). RLS makes deleting a
// foreign/nonexistent id a no-op; children cascade and workouts.template_id
// is on-delete-set-null.
export async function deleteTemplate(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("templates").delete().eq("id", id);
  revalidatePath("/templates");
}
