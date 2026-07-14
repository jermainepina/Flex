import Link from "next/link";

const base = "rounded-md px-4 py-1.5 text-sm font-semibold";
const on = "bg-(--accent) text-(--accent-ink)";
const off =
  "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800";

/**
 * Segmented control tying the merged "Progress" section together: History and
 * Stats stay separate routes (deep links unchanged), this just makes them
 * feel like two views of one place.
 */
export function ProgressSwitcher({ active }: { active: "history" | "stats" }) {
  return (
    <div className="flex gap-1 self-start rounded-lg border border-zinc-200 p-1 dark:border-zinc-800">
      <Link href="/history" className={`${base} ${active === "history" ? on : off}`}>
        History
      </Link>
      <Link href="/trends" className={`${base} ${active === "stats" ? on : off}`}>
        Stats
      </Link>
    </div>
  );
}
