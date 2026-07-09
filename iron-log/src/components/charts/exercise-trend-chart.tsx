"use client";

import { useId } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
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
      value={`${Number(payload[0].value ?? 0).toLocaleString("en-US")} ${unit}`}
    />
  );
}

export function ExerciseTrendChart({
  data,
  unit,
  color = "var(--chart-1)",
}: {
  data: TrendPoint[];
  unit: string;
  color?: string;
}) {
  // Unique per instance so multiple charts on one page don't share defs.
  const gradientId = useId().replace(/[^a-zA-Z0-9]/g, "");

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
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
          <Area
            type="monotone"
            dataKey="weight"
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={{ r: 3, fill: color, strokeWidth: 0 }}
            activeDot={{ r: 6 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
