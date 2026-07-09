import { PageHeader } from "@/components/page-header";
import { TemplatePicker } from "@/components/template-picker";
import { WorkoutLogger, type InitialTemplate } from "@/components/workout-logger";
import { createClient } from "@/lib/supabase/server";
import { type WeightUnit } from "@/lib/units";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type TemplateJoin = {
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

export default async function LogPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>;
}) {
  const { template: templateParam } = await searchParams;
  const supabase = await createClient();

  const [{ data: exercises }, { data: profile }, { data: templates }] =
    await Promise.all([
      supabase.from("exercises").select("id, name").order("name"),
      supabase.from("profiles").select("preferred_unit").maybeSingle(),
      supabase.from("templates").select("id, name").order("name"),
    ]);

  const unit: WeightUnit = profile?.preferred_unit === "kg" ? "kg" : "lb";

  // Prefill from a template if requested; silently ignore bad/foreign ids
  // (RLS returns no row) and fall back to a blank logger.
  let initialTemplate: InitialTemplate | null = null;
  if (templateParam && UUID_RE.test(templateParam)) {
    const { data } = await supabase
      .from("templates")
      .select(
        "id, name, template_exercises(exercise_id, position, target_sets, notes, target_weights)",
      )
      .eq("id", templateParam)
      .maybeSingle();
    const t = data as unknown as TemplateJoin | null;
    if (t && t.template_exercises.length > 0) {
      initialTemplate = {
        id: t.id,
        name: t.name,
        entries: [...t.template_exercises]
          .sort((a, b) => a.position - b.position)
          .map((e) => ({
            exerciseId: e.exercise_id,
            sets: e.target_sets,
            notes: e.notes,
            weightsKg: Array.from(
              { length: e.target_sets },
              (_, i) => e.target_weights?.[i] ?? null,
            ),
          })),
      };
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        kicker={new Date().toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
        titleA="Log"
        titleB="Workout"
        action={
          (templates ?? []).length > 0 ? (
            <TemplatePicker
              templates={templates ?? []}
              selectedId={initialTemplate?.id ?? null}
            />
          ) : undefined
        }
      />
      <WorkoutLogger
        key={initialTemplate?.id ?? "blank"}
        initialExercises={exercises ?? []}
        unit={unit}
        initialTemplate={initialTemplate}
      />
    </div>
  );
}
