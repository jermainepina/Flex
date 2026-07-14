"use client";

import type { CompletedGoal } from "@/app/(app)/log/actions";

// Deterministic pseudo-random confetti layout (render must stay pure, so no
// Math.random) — index-derived spread reads as random on screen.
const CONFETTI = Array.from({ length: 28 }, (_, i) => ({
  left: (i * 37 + 11) % 100, // %
  delay: ((i * 7) % 16) / 10, // 0–1.5s
  duration: 2.4 + ((i * 13) % 10) / 6, // 2.4–3.9s
  size: 6 + ((i * 5) % 3) * 2, // 6/8/10 px
  color: i % 8 === 7 ? "var(--accent)" : `var(--chart-${(i % 7) + 1})`,
}));

/**
 * Full-screen "goal crushed" overlay shown when a saved workout pushes one or
 * more goals over their target: confetti, the goal labels crossed off with a
 * staggered strike-through, and a Continue button onward to the summary.
 */
export function GoalCelebration({
  goals,
  onContinue,
}: {
  goals: CompletedGoal[];
  onContinue: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="goal-celebration-title"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 overflow-hidden px-6"
      style={{ background: "var(--accent-ink)" }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {CONFETTI.map((c, i) => (
          <span
            key={i}
            className="absolute top-0 block rounded-[2px] motion-safe:animate-[confetti-fall_var(--dur)_linear_var(--delay)_infinite] motion-reduce:hidden"
            style={{
              left: `${c.left}%`,
              width: c.size,
              height: c.size * 1.6,
              background: c.color,
              ["--dur" as string]: `${c.duration}s`,
              ["--delay" as string]: `${c.delay}s`,
            }}
          />
        ))}
      </div>

      <h2
        id="goal-celebration-title"
        className="font-display text-center text-4xl tracking-tight motion-safe:animate-[go-pop_0.5s_cubic-bezier(0.2,1.4,0.5,1)_both] sm:text-6xl"
        style={{ color: "var(--accent)" }}
      >
        {goals.length > 1 ? "GOALS CRUSHED" : "GOAL CRUSHED"}
      </h2>

      <ul className="flex w-full max-w-md flex-col gap-4">
        {goals.map((goal, i) => (
          <li
            key={goal.id}
            className="flex items-center gap-3 motion-safe:animate-[star-pop_0.45s_cubic-bezier(0.2,1.4,0.5,1)_both]"
            style={{ animationDelay: `${500 + i * 300}ms` }}
          >
            <span
              aria-hidden
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg"
              style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
            >
              ✓
            </span>
            <span className="relative min-w-0">
              <span className="block truncate text-lg font-semibold text-white">
                {goal.label}
              </span>
              <span
                aria-hidden
                className="absolute top-1/2 left-0 block h-0.5 w-full motion-safe:w-0 motion-safe:animate-[goal-strike_0.5s_ease-out_forwards]"
                style={{
                  background: "var(--accent)",
                  animationDelay: `${800 + i * 300}ms`,
                }}
              />
              <span className="label-mono block" style={{ color: "var(--accent)" }}>
                Completed
              </span>
            </span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onContinue}
        className="btn-accent w-full max-w-md px-4 py-3.5 text-sm motion-safe:animate-[star-pop_0.4s_ease-out_both]"
        style={{ animationDelay: `${900 + goals.length * 300}ms` }}
      >
        Continue
      </button>
    </div>
  );
}
