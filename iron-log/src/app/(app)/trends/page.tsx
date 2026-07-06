import Link from "next/link";
import { ExerciseTrendChart } from "@/components/charts/exercise-trend-chart";
import {
  MuscleGroupChart,
  type GroupVolumePoint,
} from "@/components/charts/muscle-group-chart";
import { VolumeChart } from "@/components/charts/volume-chart";
import { ExercisePicker } from "@/components/exercise-picker";
import { createClient } from "@/lib/supabase/server";
import {
  MUSCLE_GROUP_LABELS,
  MUSCLE_GROUPS,
  type Exercise,
  type MuscleGroup,
} from "@/lib/types";
import { formatWeight, kgToUnit, type WeightUnit } from "@/lib/units";
import {
  aggregateVolume,
  muscleGroupWeeklyVolume,
  progressionRate,
  sessionBestSeries,
  type Granularity,
  type SessionSetRow,
} from "@/lib/volume";

const RANGES: { key: Granularity; label: string }[] = [
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "yearly", label: "Yearly" },
];

type WideSetRow = {
  weight: number;
  reps: number;
  workout_exercises: {
    workout_id: string;
    exercise_id: string;
    workouts: { date: string };
    exercises: { muscle_group: MuscleGroup };
  };
};

const toggleBase = "rounded-md px-3 py-1.5 text-sm font-medium";
const toggleOn = "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900";
const toggleOff =
  "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800";

const emptyBox =
  "rounded-lg border border-dashed border-zinc-300 p-6 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400";

export default async function TrendsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; range?: string; exercise?: string }>;
}) {
  const params = await searchParams;
  const tab = params.tab === "exercise" ? "exercise" : "overview";
  const range: Granularity = (RANGES.map((r) => r.key) as string[]).includes(
    params.range ?? "",
  )
    ? (params.range as Granularity)
    : "weekly";

  const supabase = await createClient();
  const [{ data: profile }, { data: wideRows }, { data: exerciseRows }] =
    await Promise.all([
      supabase.from("profiles").select("preferred_unit").maybeSingle(),
      supabase
        .from("sets")
        .select(
          "weight, reps, workout_exercises!inner(workout_id, exercise_id, workouts!inner(date), exercises!inner(muscle_group))",
        ),
      supabase.from("exercises").select("id, name").order("name"),
    ]);

  const unit: WeightUnit = profile?.preferred_unit === "kg" ? "kg" : "lb";
  const exercises = (exerciseRows ?? []) as Exercise[];
  const rows = (wideRows ?? []) as unknown as WideSetRow[];
  const hasAnyData = rows.length > 0;

  // Per-exercise session rows (powers main lifts and the exercise tab).
  const byExercise = new Map<string, SessionSetRow[]>();
  for (const r of rows) {
    const we = r.workout_exercises;
    const list = byExercise.get(we.exercise_id) ?? [];
    list.push({
      workoutId: we.workout_id,
      date: we.workouts.date,
      weightKg: r.weight,
      reps: r.reps,
    });
    byExercise.set(we.exercise_id, list);
  }
  const sessionCount = (id: string) =>
    new Set((byExercise.get(id) ?? []).map((r) => r.workoutId)).size;

  const nameOf = new Map(exercises.map((e) => [e.id, e.name]));
  const mainLifts = [...byExercise.keys()]
    .sort((a, b) => sessionCount(b) - sessionCount(a))
    .slice(0, 3)
    .map((id) => ({
      id,
      name: nameOf.get(id) ?? "Unknown",
      rate: progressionRate(byExercise.get(id) ?? []),
    }));

  const selectedId =
    exercises.find((e) => e.id === params.exercise)?.id ??
    mainLifts[0]?.id ??
    exercises[0]?.id;
  const selected = exercises.find((e) => e.id === selectedId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Trends</h1>
        <div className="flex gap-1 rounded-lg border border-zinc-200 p-1 dark:border-zinc-800">
          <Link
            href="/trends"
            className={`${toggleBase} ${tab === "overview" ? toggleOn : toggleOff}`}
          >
            Overview
          </Link>
          <Link
            href={`/trends?tab=exercise${selectedId ? `&exercise=${selectedId}` : ""}`}
            className={`${toggleBase} ${tab === "exercise" ? toggleOn : toggleOff}`}
          >
            By exercise
          </Link>
        </div>
      </div>

      {tab === "overview" ? (
        <OverviewTab
          rows={rows}
          hasAnyData={hasAnyData}
          range={range}
          unit={unit}
          mainLifts={mainLifts}
        />
      ) : (
        <ExerciseTab
          sessionRows={selectedId ? (byExercise.get(selectedId) ?? []) : []}
          exercises={exercises}
          selected={selected}
          unit={unit}
        />
      )}
    </div>
  );
}

function OverviewTab({
  rows,
  hasAnyData,
  range,
  unit,
  mainLifts,
}: {
  rows: WideSetRow[];
  hasAnyData: boolean;
  range: Granularity;
  unit: WeightUnit;
  mainLifts: { id: string; name: string; rate: ReturnType<typeof progressionRate> }[];
}) {
  const volumeData = aggregateVolume(
    rows.map((r) => ({
      date: r.workout_exercises.workouts.date,
      weightKg: r.weight,
      reps: r.reps,
    })),
    range,
  ).map((b) => ({ label: b.label, volume: Math.round(kgToUnit(b.totalKg, unit)) }));

  const groupBuckets = muscleGroupWeeklyVolume(
    rows.map((r) => ({
      date: r.workout_exercises.workouts.date,
      weightKg: r.weight,
      reps: r.reps,
      muscleGroup: r.workout_exercises.exercises.muscle_group,
    })),
    MUSCLE_GROUPS,
  );
  const groupData: GroupVolumePoint[] = groupBuckets.map((b) => ({
    label: b.label,
    ...(Object.fromEntries(
      MUSCLE_GROUPS.map((g) => [g, Math.round(kgToUnit(b.groupsKg[g], unit))]),
    ) as Record<MuscleGroup, number>),
  }));
  const presentGroups = MUSCLE_GROUPS.filter((g) =>
    groupData.some((d) => d[g] > 0),
  );

  const rate1 = (kg: number) => Math.round(kgToUnit(kg, unit) * 10) / 10;
  const signed = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v)}`;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <h2 className="font-medium">
          Main lifts{" "}
          <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400">
            (most-logged, est. 1RM trend over the last 5 weeks)
          </span>
        </h2>
        {mainLifts.length === 0 ? (
          <p className={emptyBox}>
            No workouts yet — trends appear once you{" "}
            <Link href="/log" className="font-medium underline">
              log a workout
            </Link>
            .
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {mainLifts.map((lift) => (
              <div
                key={lift.id}
                className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
              >
                <p className="truncate text-sm font-medium">{lift.name}</p>
                {lift.rate ? (
                  <>
                    <p className="mt-2 text-2xl font-semibold tracking-tight">
                      {formatWeight(lift.rate.latestBestKg, unit)}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      best est. 1RM this week
                    </p>
                    <p className="mt-2 text-sm font-medium">
                      {signed(rate1(lift.rate.ratePerWeekKg))} {unit}/wk
                      <span className="ml-1 font-normal text-zinc-500 dark:text-zinc-400">
                        ≈ {signed(Math.round(rate1(lift.rate.ratePerWeekKg) * 4.33 * 10) / 10)}{" "}
                        {unit}/mo
                      </span>
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                    Not enough recent data.
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

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
                href={`/trends?range=${r.key}`}
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
          <p className={emptyBox}>No data yet.</p>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-medium">
          Volume by muscle group{" "}
          <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400">
            (per week, {unit})
          </span>
        </h2>
        {groupData.length > 0 ? (
          <>
            <MuscleGroupChart data={groupData} unit={unit} />
            <details className="text-sm">
              <summary className="cursor-pointer text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
                View as table
              </summary>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-max text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                      <th className="py-1.5 pr-4 font-medium">Week</th>
                      {presentGroups.map((g) => (
                        <th key={g} className="py-1.5 pr-4 font-medium">
                          {MUSCLE_GROUP_LABELS[g]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {groupData.map((d) => (
                      <tr
                        key={d.label}
                        className="border-b border-zinc-100 dark:border-zinc-900"
                      >
                        <td className="py-1.5 pr-4 font-medium">{d.label}</td>
                        {presentGroups.map((g) => (
                          <td key={g} className="py-1.5 pr-4 tabular-nums">
                            {d[g].toLocaleString("en-US")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        ) : (
          <p className={emptyBox}>No data yet.</p>
        )}
      </section>
    </div>
  );
}

function ExerciseTab({
  sessionRows,
  exercises,
  selected,
  unit,
}: {
  sessionRows: SessionSetRow[];
  exercises: Exercise[];
  selected: Exercise | undefined;
  unit: WeightUnit;
}) {
  const round1 = (kg: number) => Math.round(kgToUnit(kg, unit) * 10) / 10;
  const topSetData = sessionBestSeries(sessionRows, "weight").map((p) => ({
    label: p.label,
    weight: round1(p.bestKg),
  }));
  const e1rmData = sessionBestSeries(sessionRows, "e1rm").map((p) => ({
    label: p.label,
    weight: round1(p.bestKg),
  }));

  if (exercises.length === 0 || !selected) {
    return <p className={emptyBox}>No exercises yet.</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Charts for a single exercise — pick one:
        </p>
        <ExercisePicker exercises={exercises} selectedId={selected.id} />
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="font-medium">
          Top-set weight{" "}
          <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400">
            (heaviest set per workout, {unit})
          </span>
        </h2>
        {topSetData.length >= 2 ? (
          <ExerciseTrendChart data={topSetData} unit={unit} />
        ) : (
          <p className={emptyBox}>
            Not enough data for {selected.name} yet — log it in at least two
            workouts.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-medium">
          Estimated 1RM{" "}
          <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400">
            (Epley: weight × (1 + reps/30), best set per workout, {unit})
          </span>
        </h2>
        {e1rmData.length >= 2 ? (
          <ExerciseTrendChart data={e1rmData} unit={unit} />
        ) : (
          <p className={emptyBox}>
            Not enough data for {selected.name} yet — log it in at least two
            workouts.
          </p>
        )}
      </section>
    </div>
  );
}
