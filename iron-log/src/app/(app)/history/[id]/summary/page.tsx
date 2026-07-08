import Link from "next/link";
import { notFound } from "next/navigation";
import { SummaryStats } from "@/components/summary-stats";
import { createClient } from "@/lib/supabase/server";
import { WORKOUT_TYPE_EMOJI, WORKOUT_TYPE_LABELS, type WorkoutType } from "@/lib/types";
import { kgToUnit, type WeightUnit } from "@/lib/units";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SummaryWorkout = {
  id: string;
  date: string;
  type: WorkoutType | null;
  duration_seconds: number | null;
  workout_exercises: {
    sets: { weight: number; reps: number; is_pr: boolean }[];
  }[];
};

export default async function WorkoutSummaryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const supabase = await createClient();
  const [{ data }, { data: profile }] = await Promise.all([
    supabase
      .from("workouts")
      .select("id, date, type, duration_seconds, workout_exercises(sets(weight, reps, is_pr))")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("profiles").select("preferred_unit").maybeSingle(),
  ]);
  if (!data) notFound();
  const workout = data as unknown as SummaryWorkout;
  const unit: WeightUnit = profile?.preferred_unit === "kg" ? "kg" : "lb";

  const sets = workout.workout_exercises.flatMap((we) => we.sets);
  const volumeKg = sets.reduce((sum, s) => sum + s.weight * s.reps, 0);
  const prCount = sets.filter((s) => s.is_pr).length;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <div className="text-center">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Workout saved 💪
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {new Date(workout.date).toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
            timeZone: "UTC",
          })}
        </h1>
        {workout.type && (
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            <span aria-hidden>{WORKOUT_TYPE_EMOJI[workout.type]}</span>{" "}
            {WORKOUT_TYPE_LABELS[workout.type]}
          </p>
        )}
      </div>

      <SummaryStats
        durationSeconds={workout.duration_seconds}
        totalSets={sets.length}
        volume={Math.round(kgToUnit(volumeKg, unit))}
        unit={unit}
        prCount={prCount}
      />

      <div className="flex justify-center gap-3">
        <Link
          href={`/history/${workout.id}`}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          View workout
        </Link>
        <Link
          href="/dashboard"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Done
        </Link>
      </div>
    </div>
  );
}
