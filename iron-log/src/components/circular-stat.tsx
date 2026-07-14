/**
 * Small SVG progress ring with centered content — e.g. a big number. Rotated
 * so progress starts at 12 o'clock rather than SVG's default 3 o'clock.
 */
export function CircularStat({
  pct,
  color = "var(--chart-accent)",
  size = 64,
  strokeWidth = 5,
  children,
}: {
  pct: number;
  color?: string;
  size?: number;
  strokeWidth?: number;
  children?: React.ReactNode;
}) {
  const clamped = Math.max(0, Math.min(1, pct));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-zinc-200 dark:stroke-zinc-800"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">
          {children}
        </div>
      )}
    </div>
  );
}
