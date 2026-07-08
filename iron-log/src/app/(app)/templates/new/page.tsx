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
      <h1 className="text-2xl font-semibold tracking-tight">New template</h1>
      <TemplateEditor exercises={(exercises ?? []) as Exercise[]} unit={unit} />
    </div>
  );
}
