import { MACROS, type FoodEntry, type NutritionTargets } from "@/lib/nutrition";

const fmt = (n: number) =>
  Math.round(n) === n ? n.toLocaleString("en-US") : (Math.round(n * 10) / 10).toLocaleString("en-US");

/**
 * One slim progress bar per macro (server-renderable — no client hooks).
 * Sugar is a cap: its bar turns red past the target instead of lime.
 */
export function MacroBars({
  totals,
  targets,
}: {
  totals: FoodEntry;
  targets: NutritionTargets;
}) {
  return (
    <ul className="flex flex-col gap-3">
      {MACROS.map((m) => {
        const current = totals[m.key];
        const target = targets[m.key];
        if (!target) return null;
        const pct = Math.min(1, current / target);
        const over = current > target;
        const capBlown = m.direction === "under" && over;
        return (
          <li key={m.key}>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-medium">{m.label}</span>
              <span
                className={`text-xs ${
                  capBlown
                    ? "font-medium text-red-600 dark:text-red-400"
                    : "text-zinc-500 dark:text-zinc-400"
                }`}
              >
                {fmt(current)} / {m.direction === "under" ? "under " : ""}
                {fmt(target)} {m.unit}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
              <div
                className="h-full rounded-full transition-[width] duration-300"
                style={{
                  width: `${Math.round(pct * 100)}%`,
                  background: capBlown ? "var(--color-red-500)" : "var(--chart-accent)",
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
