import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  WORKOUT_TYPE_EMOJI,
  WORKOUT_TYPE_LABELS,
  type WorkoutType,
} from "@/lib/types";
import { formatWeight, type WeightUnit } from "@/lib/units";

type WorkoutDetail = {
  id: string;
  date: string;
  type: WorkoutType | null;
  workout_exercises: {
    id: string;
    notes: string | null;
    position: number;
    exercises: { name: string } | null;
    sets: { set_number: number; weight: number; reps: number }[];
  }[];
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function WorkoutDetailPage({
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
      .select(
        "id, date, type, workout_exercises(id, notes, position, exercises(name), sets(set_number, weight, reps))",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("profiles").select("preferred_unit").maybeSingle(),
  ]);

  // RLS returns no row for other users' workouts — same as a bad id.
  if (!data) notFound();
  const workout = data as unknown as WorkoutDetail;
  const unit: WeightUnit = profile?.preferred_unit === "kg" ? "kg" : "lb";

  const exercises = [...workout.workout_exercises].sort(
    (a, b) => a.position - b.position,
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/history"
          className="text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          ← History
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {new Date(workout.date).toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
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

      {exercises.map((entry) => {
        const sets = [...entry.sets].sort((a, b) => a.set_number - b.set_number);
        return (
          <section
            key={entry.id}
            className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <h2 className="font-medium">
              {entry.exercises?.name ?? "Unknown exercise"}
            </h2>
            <div className="mt-3 grid grid-cols-[2.5rem_1fr_1fr] gap-x-2 gap-y-1 text-sm">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Set
              </span>
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Weight
              </span>
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Reps
              </span>
              {sets.map((s) => (
                <div key={s.set_number} className="contents">
                  <span className="text-zinc-500 dark:text-zinc-400">
                    {s.set_number}
                  </span>
                  <span>{formatWeight(s.weight, unit)}</span>
                  <span>{s.reps}</span>
                </div>
              ))}
            </div>
            {entry.notes && (
              <p className="mt-3 rounded-md bg-zinc-100 px-3 py-2 text-sm text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {entry.notes}
              </p>
            )}
          </section>
        );
      })}

      {exercises.length === 0 && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          This workout has no exercises.
        </p>
      )}
    </div>
  );
}
