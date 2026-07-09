"use client";

import { useEffect, useState } from "react";

function useCountUp(target: number, ms = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      if (reduceMotion) {
        setValue(target);
        return;
      }
      const p = Math.min(1, (t - t0) / ms);
      const eased = 1 - (1 - p) ** 3;
      setValue(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}

function formatDuration(totalSeconds: number) {
  const s = Math.round(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-4">
      <p className="label-mono">{label}</p>
      <p className="font-display mt-1.5 text-2xl tabular-nums">{value}</p>
      {sub && <p className="text-xs text-zinc-500 dark:text-zinc-400">{sub}</p>}
    </div>
  );
}

export function SummaryStats({
  durationSeconds,
  totalSets,
  volume,
  unit,
  prCount,
}: {
  durationSeconds: number | null;
  totalSets: number;
  volume: number;
  unit: string;
  prCount: number;
}) {
  const animDuration = useCountUp(durationSeconds ?? 0);
  const animSets = useCountUp(totalSets);
  const animVolume = useCountUp(volume);
  const stars = Math.min(prCount, 8);

  return (
    <div className="flex flex-col gap-6">
      {prCount > 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-amber-400 bg-amber-400/10 p-6 text-center dark:border-amber-500">
          <div className="flex gap-1 text-3xl" aria-hidden>
            {Array.from({ length: stars }, (_, i) => (
              <span
                key={i}
                className="motion-safe:animate-[star-pop_0.5s_cubic-bezier(0.2,1.4,0.5,1)_both]"
                style={{ animationDelay: `${400 + i * 150}ms` }}
              >
                ⭐
              </span>
            ))}
          </div>
          <p className="text-lg font-semibold text-amber-600 dark:text-amber-400">
            {prCount} personal record{prCount === 1 ? "" : "s"}!
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Tile
          label="Duration"
          value={durationSeconds === null ? "—" : formatDuration(animDuration)}
        />
        <Tile label="Total sets" value={String(Math.round(animSets))} />
        <Tile
          label="Total volume"
          value={Math.round(animVolume).toLocaleString("en-US")}
          sub={`${unit} (weight × reps)`}
        />
      </div>
    </div>
  );
}
