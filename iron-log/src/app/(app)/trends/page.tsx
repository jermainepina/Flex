import Link from "next/link";
import { ExerciseTrendChart } from "@/components/charts/exercise-trend-chart";
import { VolumeChart } from "@/components/charts/volume-chart";
import { ExercisePicker } from "@/components/exercise-picker";
import { createClient } from "@/lib/supabase/server";
import { type Exercise } from "@/lib/types";
import { kgToUnit, type WeightUnit } from "@/lib/units";
import {
  aggregateVolume,
  topSetSeries,
  type Granularity,
  type TopSetRow,
  type VolumeRow,
} from "@/lib/volume";

const RANGES: { key: Granularity; label: string }[] = [
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "yearly", label: "Yearly" },
];

type SetJoinRow = {
  weight: number;
  reps: number;
  workout_exercises: { workouts: { date: string } };
};

type TopSetJoinRow = {
  workout_id: string;
  workouts: { date: string };
  sets: { weight: number }[];
};

const toggleBase = "rounded-md px-3 py-1.5 text-sm font-medium";
const toggleOn = "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900";
const toggleOff =
  "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800";

export default async function TrendsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; exercise?: string }>;
}) {
  const params = await searchParams;
  const range: Granularity = (RANGES.map((r) => r.key) as string[]).includes(
    params.range ?? "",
  )
    ? (params.range as Granularity)
    : "weekly";

  const supabase = await createClient();
  const [{ data: profile }, { data: setRows }, { data: exerciseRows }, { data: usageRows }] =
    await Promise.all([
      supabase.from("profiles").select("preferred_unit").maybeSingle(),
      supabase
        .from("sets")
        .select("weight, reps, workout_exercises!inner(workouts!inner(date))"),
      supabase.from("exercises").select("id, name").order("name"),
      supabase.from("workout_exercises").select("exercise_id"),
    ]);

  const unit: WeightUnit = profile?.preferred_unit === "kg" ? "kg" : "lb";
  const exercises = (exerciseRows ?? []) as Exercise[];

  const volumeRows: VolumeRow[] = ((setRows ?? []) as unknown as SetJoinRow[]).map(
    (r) => ({
      date: r.workout_exercises.workouts.date,
      weightKg: r.weight,
      reps: r.reps,
    }),
  );
  const buckets = aggregateVolume(volumeRows, range);
  const volumeData = buckets.map((b) => ({
    label: b.label,
    volume: Math.round(kgToUnit(b.totalKg, unit)),
  }));

  // Default trend exercise: the most-logged one.
  const usage = new Map<string, number>();
  for (const row of usageRows ?? []) {
    usage.set(row.exercise_id, (usage.get(row.exercise_id) ?? 0) + 1);
  }
  const mostLogged = [...usage.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const selectedId =
    exercises.find((e) => e.id === params.exercise)?.id ??
    mostLogged ??
    exercises[0]?.id;
  const selected = exercises.find((e) => e.id === selectedId);

  let trendData: { label: string; weight: number }[] = [];
  if (selectedId) {
    const { data: topRows } = await supabase
      .from("workout_exercises")
      .select("workout_id, workouts!inner(date), sets(weight)")
      .eq("exercise_id", selectedId);
    const flat: TopSetRow[] = ((topRows ?? []) as unknown as TopSetJoinRow[]).flatMap(
      (r) =>
        r.sets.map((s) => ({
          workoutId: r.workout_id,
          date: r.workouts.date,
          weightKg: s.weight,
        })),
    );
    trendData = topSetSeries(flat).map((p) => ({
      label: p.label,
      weight: Math.round(kgToUnit(p.maxKg, unit) * 10) / 10,
    }));
  }

  const hasAnyData = volumeRows.length > 0;

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold tracking-tight">Trends</h1>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-medium">
            Total volume{" "}
            <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400">
              (weight × reps, {unit})
            </span>
          </h2>
          <div className="flex gap-1 rounded-lg border border-zinc-200 p-1 dark:border-zinc-800">
            {RANGES.map((r) => (
              <Link
                key={r.key}
                href={`/trends?range=${r.key}${selectedId ? `&exercise=${selectedId}` : ""}`}
                className={`${toggleBase} ${range === r.key ? toggleOn : toggleOff}`}
              >
                {r.label}
              </Link>
            ))}
          </div>
        </div>
        {hasAnyData ? (
          <VolumeChart data={volumeData} unit={unit} />
        ) : (
          <p className="rounded-lg border border-dashed border-zinc-300 p-6 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            No workouts yet — trends appear once you{" "}
            <Link href="/log" className="font-medium underline">
              log a workout
            </Link>
            .
          </p>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-medium">
            Top-set weight{" "}
            <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400">
              (heaviest set per workout, {unit})
            </span>
          </h2>
          {exercises.length > 0 && selectedId && (
            <ExercisePicker
              exercises={exercises}
              selectedId={selectedId}
              range={range}
            />
          )}
        </div>
        {selected && trendData.length >= 2 ? (
          <ExerciseTrendChart data={trendData} unit={unit} />
        ) : (
          <p className="rounded-lg border border-dashed border-zinc-300 p-6 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            {selected
              ? `Not enough data for ${selected.name} yet — log it in at least two workouts.`
              : "No exercises yet."}
          </p>
        )}
      </section>
    </div>
  );
}
