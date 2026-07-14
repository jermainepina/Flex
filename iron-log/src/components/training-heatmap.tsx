import { nameColorVar, workoutDisplayName } from "@/lib/types";
import { bucketKey } from "@/lib/volume";

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Multi-month dot heatmap of trained days (Monday-start weeks, matching
 * bucketKey's convention app-wide). Week columns flex to fill the card width
 * so the dots stay comfortably large on any screen. Presentational only —
 * the native `title` attribute gives a cheap hover hint, no client JS.
 */
export function TrainingHeatmap({
  days,
  sinceDate,
  untilDate,
}: {
  days: { date: string; name: string | null }[];
  sinceDate: string;
  untilDate: string;
}) {
  const byDate = new Map<string, string | null>();
  for (const d of days) byDate.set(d.date.slice(0, 10), d.name);

  const firstMonday = bucketKey(sinceDate, "weekly");
  const columns: { monday: string; days: (string | null)[] }[] = [];
  for (let monday = firstMonday; monday <= untilDate; monday = addDays(monday, 7)) {
    const colDays: (string | null)[] = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(monday, i);
      colDays.push(date > untilDate ? null : date);
    }
    columns.push({ monday, days: colDays });
  }

  let lastMonth = "";

  return (
    <div className="flex w-full flex-col gap-1.5">
      <div className="flex w-full gap-1">
        {columns.map((col, i) => {
          const month = new Date(`${col.monday}T00:00:00Z`).toLocaleDateString(
            "en-US",
            { month: "short", timeZone: "UTC" },
          );
          const showLabel = month !== lastMonth;
          lastMonth = month;
          return (
            <span
              key={i}
              className="min-w-0 flex-1 overflow-visible whitespace-nowrap text-[10px] text-zinc-400 dark:text-zinc-500"
            >
              {showLabel ? month : ""}
            </span>
          );
        })}
      </div>
      <div className="flex w-full gap-1">
        {columns.map((col, i) => (
          <div key={i} className="flex min-w-0 flex-1 flex-col gap-1">
            {col.days.map((date, j) => {
              if (date === null) {
                return <span key={j} className="aspect-square w-full" />;
              }
              const name = byDate.get(date);
              const trained = name !== undefined;
              return (
                <span
                  key={j}
                  aria-hidden
                  title={trained ? `${workoutDisplayName(name, null)} — ${date}` : date}
                  className={`aspect-square w-full rounded-full ${
                    trained ? "" : "bg-zinc-200 dark:bg-zinc-800"
                  }`}
                  style={
                    trained
                      ? { background: nameColorVar(workoutDisplayName(name, null)) }
                      : undefined
                  }
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
