import Link from "next/link";
import { notFound } from "next/navigation";
import { PrChip } from "@/components/pr-chip";
import { createClient } from "@/lib/supabase/server";
import { nameColorVar, workoutDisplayName, type WorkoutType } from "@/lib/types";
import { formatWeight, type WeightUnit } from "@/lib/units";

type WorkoutDetail = {
  id: string;
  date: string;
  name: string | null;
  type: WorkoutType | null; // legacy fallback label
  workout_exercises: {
    id: string;
    notes: string | null;
    position: number;
    exercises: { name: string } | null;
    sets: { set_number: number; weight: number; reps: number; is_pr: boolean }[];
  }[];
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function WorkoutDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  if (!UUID_RE.test(id)) notFound();
  const backHref = from === "dashboard" ? "/dashboard" : "/history";
  const backLabel = from === "dashboard" ? "Dashboard" : "History";

  const supabase = await createClient();
  const [{ data }, { data: profile }] = await Promise.all([
    supabase
      .from("workouts")
      .select(
        "id, date, name, type, workout_exercises(id, notes, position, exercises(name), sets(set_number, weight, reps, is_pr))",
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
          href={backHref}
          className="text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          ← {backLabel}
        </Link>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <span
            aria-hidden
            className="inline-block h-3 w-3 shrink-0 rounded-full"
            style={{
              background: nameColorVar(
                workoutDisplayName(workout.name, workout.type),
              ),
            }}
          />
          {workoutDisplayName(workout.name, workout.type)}
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {new Date(workout.date).toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
            timeZone: "UTC",
          })}
        </p>
      </div>

      {exercises.map((entry) => {
        const sets = [...entry.sets].sort((a, b) => a.set_number - b.set_number);
        return (
          <section key={entry.id} className="card p-4">
            <h2 className="font-medium">
              {entry.exercises?.name ?? "Unknown exercise"}
            </h2>
            <div className="mt-3 grid grid-cols-[4rem_1fr_1fr] gap-x-2 gap-y-1 text-sm">
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
                  <span className="flex items-center gap-1 text-zinc-500 dark:text-zinc-400">
                    {s.set_number}
                    {s.is_pr && <PrChip />}
                  </span>
                  <span className={s.is_pr ? "font-medium text-amber-600 dark:text-amber-400" : ""}>
                    {formatWeight(s.weight, unit)}
                  </span>
                  <span className={s.is_pr ? "font-medium text-amber-600 dark:text-amber-400" : ""}>
                    {s.reps}
                  </span>
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
