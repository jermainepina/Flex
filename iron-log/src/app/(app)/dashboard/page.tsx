import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { WORKOUT_TYPE_LABELS, type WorkoutType } from "@/lib/types";

type RecentWorkout = {
  id: string;
  date: string;
  type: WorkoutType | null;
  workout_exercises: { count: number }[];
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workouts")
    .select("id, date, type, workout_exercises(count)")
    .order("date", { ascending: false })
    .limit(5);

  const workouts = (data ?? []) as RecentWorkout[];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <Link
          href="/log"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Log workout
        </Link>
      </div>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Recent workouts
          </h2>
          <Link
            href="/history"
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            View all →
          </Link>
        </div>
        {workouts.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-zinc-300 p-6 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            No workouts yet. Log your first one to get started.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {workouts.map((w) => {
              const exerciseCount = w.workout_exercises[0]?.count ?? 0;
              return (
                <li key={w.id}>
                  <Link
                    href={`/history/${w.id}`}
                    className="flex items-center justify-between px-4 py-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  >
                    <span className="font-medium">
                      {new Date(w.date).toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        timeZone: "UTC",
                      })}
                    </span>
                    <span className="text-zinc-500 dark:text-zinc-400">
                      {w.type ? `${WORKOUT_TYPE_LABELS[w.type]} · ` : ""}
                      {exerciseCount} exercise{exerciseCount === 1 ? "" : "s"}
                      <span className="ml-2 text-zinc-400">›</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
