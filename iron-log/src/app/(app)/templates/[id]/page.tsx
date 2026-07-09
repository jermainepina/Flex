import { notFound } from "next/navigation";
import { TemplateEditor } from "@/components/template-editor";
import { createClient } from "@/lib/supabase/server";
import { type Exercise } from "@/lib/types";
import { type WeightUnit } from "@/lib/units";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type TemplateDetail = {
  id: string;
  name: string;
  template_exercises: {
    exercise_id: string;
    position: number;
    target_sets: number;
    notes: string | null;
    target_weights: (number | null)[] | null;
  }[];
};

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const supabase = await createClient();
  const [{ data }, { data: exercises }, { data: profile }] = await Promise.all([
    supabase
      .from("templates")
      .select(
        "id, name, template_exercises(exercise_id, position, target_sets, notes, target_weights)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("exercises").select("id, name").order("name"),
    supabase.from("profiles").select("preferred_unit").maybeSingle(),
  ]);
  if (!data) notFound();
  const template = data as unknown as TemplateDetail;
  const unit: WeightUnit = profile?.preferred_unit === "kg" ? "kg" : "lb";

  const entries = [...template.template_exercises]
    .sort((a, b) => a.position - b.position)
    .map((e) => ({
      exerciseId: e.exercise_id,
      sets: e.target_sets,
      notes: e.notes,
      weightsKg: Array.from(
        { length: e.target_sets },
        (_, i) => e.target_weights?.[i] ?? null,
      ),
    }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="label-mono">Template builder</p>
        <h1 className="font-display mt-1 text-3xl uppercase leading-[1.05] tracking-tight sm:text-4xl">
          Edit
          <br />
          <span style={{ color: "var(--accent-text)" }}>Template</span>
        </h1>
      </div>
      <TemplateEditor
        exercises={(exercises ?? []) as Exercise[]}
        unit={unit}
        initial={{ id: template.id, name: template.name, entries }}
      />
    </div>
  );
}
