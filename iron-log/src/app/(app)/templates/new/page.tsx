import { TemplateEditor } from "@/components/template-editor";
import { createClient } from "@/lib/supabase/server";
import { type Exercise } from "@/lib/types";
import { type WeightUnit } from "@/lib/units";

export default async function NewTemplatePage() {
  const supabase = await createClient();
  const [{ data: exercises }, { data: profile }] = await Promise.all([
    supabase.from("exercises").select("id, name").order("name"),
    supabase.from("profiles").select("preferred_unit").maybeSingle(),
  ]);
  const unit: WeightUnit = profile?.preferred_unit === "kg" ? "kg" : "lb";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="label-mono">Template builder</p>
        <h1 className="font-display mt-1 text-3xl uppercase leading-[1.05] tracking-tight sm:text-4xl">
          New
          <br />
          <span style={{ color: "var(--accent-text)" }}>Template</span>
        </h1>
      </div>
      <TemplateEditor exercises={(exercises ?? []) as Exercise[]} unit={unit} />
    </div>
  );
}
