"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltipCard } from "./chart-tooltip";

export type TrendPoint = { label: string; weight: number };

// Typed loosely on purpose — recharts' Tooltip content generics don't unify
// with concrete value types.
function TrendTooltip({
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
      value={`${Number(payload[0].value ?? 0)} ${unit}`}
    />
  );
}

export function ExerciseTrendChart({
  data,
  unit,
}: {
  data: TrendPoint[];
  unit: string;
}) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
            domain={["auto", "auto"]}
          />
          <Tooltip
            content={(props) => <TrendTooltip {...props} unit={unit} />}
            cursor={{ stroke: "var(--chart-axis)", strokeDasharray: "3 3" }}
          />
          <Line
            type="monotone"
            dataKey="weight"
            stroke="var(--chart-1)"
            strokeWidth={2}
            dot={{ r: 3, fill: "var(--chart-1)", strokeWidth: 0 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
