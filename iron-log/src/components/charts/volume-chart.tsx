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
import { ChartTooltipCard } from "./chart-tooltip";

export type VolumePoint = { label: string; volume: number };

// Typed loosely on purpose — recharts' Tooltip content generics don't unify
// with concrete value types.
function VolumeTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: readonly { value?: unknown }[];
  label?: unknown;
  unit: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <ChartTooltipCard
      title={String(label)}
      value={`${Number(payload[0].value ?? 0).toLocaleString("en-US")} ${unit}`}
    />
  );
}

export function VolumeChart({
  data,
  unit,
}: {
  data: VolumePoint[];
  unit: string;
}) {
  return (
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
            content={(props) => <VolumeTooltip {...props} unit={unit} />}
            cursor={{ fill: "var(--chart-cursor)" }}
          />
          <Bar
            dataKey="volume"
            fill="var(--chart-1)"
            radius={[4, 4, 0, 0]}
            maxBarSize={28}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
