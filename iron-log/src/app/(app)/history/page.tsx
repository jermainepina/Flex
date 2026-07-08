import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { workoutDisplayName, type WorkoutType } from "@/lib/types";

type HistoryWorkout = {
  id: string;
  date: string;
  name: string | null;
  type: WorkoutType | null; // legacy fallback label for pre-name rows
  workout_exercises: { count: number }[];
};

// Workouts are stored at noon UTC (see saveWorkout), so the UTC date part of
// the ISO string IS the calendar day — group and display with UTC everywhere.
const utcDay = (iso: string) => iso.slice(0, 10);

function currentMonth() {
  return new Date().toLocaleDateString("en-CA").slice(0, 7); // local YYYY-MM
}

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatDay(iso: string, opts: Intl.DateTimeFormatOptions) {
  return new Date(iso).toLocaleDateString(undefined, {
    ...opts,
    timeZone: "UTC",
  });
}

const toggleBase = "rounded-md px-3 py-1.5 text-sm font-medium";
const toggleOn = "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900";
const toggleOff =
  "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800";

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; month?: string }>;
}) {
  const params = await searchParams;
  const view = params.view === "list" ? "list" : "calendar";
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(params.month ?? "")
    ? (params.month as string)
    : currentMonth();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">History</h1>
        <div className="flex gap-1 rounded-lg border border-zinc-200 p-1 dark:border-zinc-800">
          <Link
            href={`/history?month=${month}`}
            className={`${toggleBase} ${view === "calendar" ? toggleOn : toggleOff}`}
          >
            Calendar
          </Link>
          <Link
            href="/history?view=list"
            className={`${toggleBase} ${view === "list" ? toggleOn : toggleOff}`}
          >
            List
          </Link>
        </div>
      </div>

      {view === "list" ? <ListView /> : <CalendarView month={month} />}
    </div>
  );
}

async function ListView() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workouts")
    .select("id, date, name, type, workout_exercises(count)")
    .order("date", { ascending: false });
  const workouts = (data ?? []) as HistoryWorkout[];

  if (workouts.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-zinc-300 p-6 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
        No workouts yet.{" "}
        <Link href="/log" className="font-medium underline">
          Log your first one.
        </Link>
      </p>
    );
  }

  // Group into month sections, preserving the date-desc order.
  const sections: { month: string; workouts: HistoryWorkout[] }[] = [];
  for (const w of workouts) {
    const m = utcDay(w.date).slice(0, 7);
    if (sections[sections.length - 1]?.month !== m) {
      sections.push({ month: m, workouts: [] });
    }
    sections[sections.length - 1].workouts.push(w);
  }

  return (
    <div className="flex flex-col gap-6">
      {sections.map((section) => (
        <section key={section.month}>
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            {monthLabel(section.month)}
          </h2>
          <ul className="mt-2 divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {section.workouts.map((w) => {
              const count = w.workout_exercises[0]?.count ?? 0;
              return (
                <li key={w.id}>
                  <Link
                    href={`/history/${w.id}`}
                    className="flex items-center justify-between px-4 py-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  >
                    <span className="flex min-w-0 items-baseline gap-2 font-medium">
                      {formatDay(w.date, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                      <span className="truncate font-normal text-zinc-500 dark:text-zinc-400">
                        {workoutDisplayName(w.name, w.type)}
                      </span>
                    </span>
                    <span className="shrink-0 text-zinc-500 dark:text-zinc-400">
                      {count} exercise{count === 1 ? "" : "s"}
                      <span className="ml-2 text-zinc-400">›</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

async function CalendarView({ month }: { month: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workouts")
    .select("id, date, name, type")
    .gte("date", `${month}-01T00:00:00Z`)
    .lt("date", `${shiftMonth(month, 1)}-01T00:00:00Z`)
    .order("date");
  const workouts = (data ?? []) as Pick<
    HistoryWorkout,
    "id" | "date" | "name" | "type"
  >[];

  const byDay = new Map<string, typeof workouts>();
  for (const w of workouts) {
    const day = utcDay(w.date);
    byDay.set(day, [...(byDay.get(day) ?? []), w]);
  }

  const [y, m] = month.split("-").map(Number);
  const firstWeekday = new Date(Date.UTC(y, m - 1, 1)).getUTCDay(); // 0 = Sunday
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (number | null)[] = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const todayKey = new Date().toLocaleDateString("en-CA");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Link
          href={`/history?view=calendar&month=${shiftMonth(month, -1)}`}
          aria-label="Previous month"
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          ‹
        </Link>
        <h2 className="text-base font-semibold">{monthLabel(month)}</h2>
        <Link
          href={`/history?view=calendar&month=${shiftMonth(month, 1)}`}
          aria-label="Next month"
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          ›
        </Link>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={`pad-${i}`} />;
          const dayKey = `${month}-${String(day).padStart(2, "0")}`;
          const dayWorkouts = byDay.get(dayKey) ?? [];
          const isToday = dayKey === todayKey;
          return (
            <div
              key={dayKey}
              className={`flex min-h-16 flex-col gap-1 rounded-lg border p-1.5 text-xs ${
                isToday
                  ? "border-zinc-900 dark:border-zinc-100"
                  : "border-zinc-200 dark:border-zinc-800"
              }`}
            >
              <span className="text-center text-zinc-500 dark:text-zinc-400">
                {day}
              </span>
              {dayWorkouts.map((w) => {
                const label = workoutDisplayName(w.name, w.type);
                return (
                  <Link
                    key={w.id}
                    href={`/history/${w.id}`}
                    title={label}
                    className="block w-full truncate rounded bg-zinc-100 px-1 py-0.5 text-[10px] font-medium leading-tight text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                  >
                    {label}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>

      {workouts.length === 0 && (
        <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
          No workouts in {monthLabel(month)}.
        </p>
      )}
    </div>
  );
}
