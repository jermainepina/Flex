"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MUSCLE_GROUP_LABELS, MUSCLE_GROUPS, type MuscleGroup } from "@/lib/types";

// One row per week: label + a value per muscle group (already in display unit).
export type GroupVolumePoint = { label: string } & Record<MuscleGroup, number>;

// Fixed slot per group — color follows the entity even when groups are empty.
const GROUP_SLOT: Record<MuscleGroup, string> = {
  chest: "var(--chart-1)",
  back: "var(--chart-2)",
  shoulders: "var(--chart-3)",
  arms: "var(--chart-4)",
  legs: "var(--chart-5)",
  core: "var(--chart-6)",
  other: "var(--chart-7)",
};

// Typed loosely on purpose — recharts' Tooltip content generics don't unify
// with concrete value types.
function GroupTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: readonly { dataKey?: unknown; value?: unknown }[];
  label?: unknown;
  unit: string;
}) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((p) => Number(p.value) > 0).reverse();
  return (
    <div className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <p className="text-zinc-500 dark:text-zinc-400">{String(label)}</p>
      {rows.map((p) => (
        <p key={String(p.dataKey)} className="mt-0.5 flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: GROUP_SLOT[p.dataKey as MuscleGroup] }}
          />
          <span className="text-zinc-500 dark:text-zinc-400">
            {MUSCLE_GROUP_LABELS[p.dataKey as MuscleGroup]}
          </span>
          <span className="ml-auto pl-3 font-medium text-zinc-900 dark:text-zinc-100">
            {Number(p.value).toLocaleString("en-US")} {unit}
          </span>
        </p>
      ))}
    </div>
  );
}

export function MuscleGroupChart({
  data,
  unit,
}: {
  data: GroupVolumePoint[];
  unit: string;
}) {
  // Only legend groups that ever appear, but keep the fixed order and colors.
  const present = MUSCLE_GROUPS.filter((g) => data.some((d) => d[g] > 0));

  return (
    <div className="flex flex-col gap-2">
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--chart-grid)"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fill: "var(--chart-muted)", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "var(--chart-axis)" }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: "var(--chart-muted)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={52}
              tickFormatter={(v: number) => v.toLocaleString("en-US")}
            />
            <Tooltip
              content={(props) => <GroupTooltip {...props} unit={unit} />}
              cursor={{ fill: "var(--chart-cursor)" }}
            />
            {MUSCLE_GROUPS.map((g) => (
              <Bar
                key={g}
                dataKey={g}
                stackId="volume"
                fill={GROUP_SLOT[g]}
                stroke="var(--background)"
                strokeWidth={1}
                maxBarSize={32}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
        {present.map((g) => (
          <li key={g} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: GROUP_SLOT[g] }}
            />
            {MUSCLE_GROUP_LABELS[g]}
          </li>
        ))}
      </ul>
    </div>
  );
}
