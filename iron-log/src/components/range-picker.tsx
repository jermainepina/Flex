"use client";

import { useRouter } from "next/navigation";

const inputClass =
  "rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-base outline-none focus:border-(--accent) sm:text-sm dark:border-zinc-700 dark:bg-zinc-950";

/** From/to date inputs for the custom volume range. */
export function RangePicker({ from, to }: { from: string; to: string }) {
  const router = useRouter();

  function push(nextFrom: string, nextTo: string) {
    if (!nextFrom || !nextTo) return;
    router.push(`/trends?range=custom&from=${nextFrom}&to=${nextTo}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <label className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
        From
        <input
          type="date"
          value={from}
          max={to}
          onChange={(e) => push(e.target.value, to)}
          className={inputClass}
        />
      </label>
      <label className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
        To
        <input
          type="date"
          value={to}
          min={from}
          onChange={(e) => push(from, e.target.value)}
          className={inputClass}
        />
      </label>
    </div>
  );
}
