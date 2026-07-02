import { WorkoutLogger } from "@/components/workout-logger";
import { createClient } from "@/lib/supabase/server";
import { type WeightUnit } from "@/lib/units";

export default async function LogPage() {
  const supabase = await createClient();

  const [{ data: exercises }, { data: profile }] = await Promise.all([
    supabase.from("exercises").select("id, name").order("name"),
    supabase.from("profiles").select("preferred_unit").maybeSingle(),
  ]);

  const unit: WeightUnit = profile?.preferred_unit === "kg" ? "kg" : "lb";

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Log workout</h1>
      <WorkoutLogger initialExercises={exercises ?? []} unit={unit} />
    </div>
  );
}
