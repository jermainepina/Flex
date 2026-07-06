"use client";

// Shared minimal tooltip card for both charts — chrome uses text/border
// tokens, never the series color.
export function ChartTooltipCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <p className="text-zinc-500 dark:text-zinc-400">{title}</p>
      <p className="mt-0.5 font-medium text-zinc-900 dark:text-zinc-100">
        {value}
      </p>
    </div>
  );
}
