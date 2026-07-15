import { FoodLog, type FoodLogEntry } from "@/components/food-log";
import { PageHeader } from "@/components/page-header";
import type { NutritionTargets } from "@/lib/nutrition";
import { createClient } from "@/lib/supabase/server";
import { type WeightUnit } from "@/lib/units";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function FoodPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date: dateParam } = await searchParams;
  const date =
    dateParam && DATE_RE.test(dateParam)
      ? dateParam
      : new Date().toLocaleDateString("en-CA");

  const supabase = await createClient();
  const [{ data: profile }, { data: goals }, { data: entries }, { data: weighIn }] =
    await Promise.all([
      supabase.from("profiles").select("preferred_unit").maybeSingle(),
      supabase
        .from("nutrition_goals")
        .select("calories, protein_g, carbs_g, fat_g, sugar_g")
        .maybeSingle(),
      supabase
        .from("food_logs")
        .select("id, name, calories, protein_g, carbs_g, fat_g, sugar_g")
        .eq("date", date)
        .order("created_at", { ascending: true }),
      supabase
        .from("body_weight_logs")
        .select("weight_kg")
        .eq("date", date)
        .maybeSingle(),
    ]);

  const unit: WeightUnit = profile?.preferred_unit === "kg" ? "kg" : "lb";
  const targets: NutritionTargets | null = goals
    ? {
        calories: goals.calories,
        proteinG: goals.protein_g,
        carbsG: goals.carbs_g,
        fatG: goals.fat_g,
        sugarG: goals.sugar_g,
      }
    : null;
  const foodEntries: FoodLogEntry[] = (entries ?? []).map((e) => ({
    id: e.id,
    name: e.name,
    calories: Number(e.calories),
    proteinG: Number(e.protein_g),
    carbsG: Number(e.carbs_g),
    fatG: Number(e.fat_g),
    sugarG: Number(e.sugar_g),
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        kicker={new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          timeZone: "UTC",
        })}
        titleA="Log"
        titleB="Food"
      />
      <FoodLog
        // Remount when the day changes so entry/weigh-in state resets.
        key={date}
        date={date}
        entries={foodEntries}
        targets={targets}
        weighInKg={weighIn?.weight_kg ?? null}
        unit={unit}
      />
    </div>
  );
}
