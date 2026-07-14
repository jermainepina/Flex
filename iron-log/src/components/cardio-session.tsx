"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { saveCardio, type CompletedGoal } from "@/app/(app)/log/actions";
import { CircularStat } from "@/components/circular-stat";
import { GoalCelebration } from "@/components/goal-celebration";

function fmt(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

/**
 * Active cardio session: one big countdown ring anchored to a start timestamp
 * (interval-callback setState, same hooks-safe pattern as the rest timer).
 * Past zero it counts overtime up instead of stopping. Target duration is
 * adjustable mid-session (the start timestamp never moves).
 */
export function CardioSession({
  initialMinutes,
  date,
  name,
}: {
  initialMinutes: number;
  date: string;
  name: string;
}) {
  const router = useRouter();
  const [targetMin, setTargetMin] = useState(initialMinutes);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const [celebration, setCelebration] = useState<{
    goals: CompletedGoal[];
    workoutId: string;
  } | null>(null);
  const [saving, startSaving] = useTransition();
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    startedAtRef.current = Date.now();
    const id = setInterval(() => {
      if (startedAtRef.current !== null) {
        setElapsed((Date.now() - startedAtRef.current) / 1000);
      }
    }, 500);
    return () => clearInterval(id);
  }, []);

  const targetSeconds = targetMin * 60;
  const remaining = targetSeconds - elapsed;
  const overtime = remaining < 0;
  const pct = targetSeconds > 0 ? Math.min(1, elapsed / targetSeconds) : 0;

  function handleFinish() {
    setError(null);
    const durationSeconds = startedAtRef.current
      ? Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000))
      : 1;
    startSaving(async () => {
      const result = await saveCardio({ date, name, durationSeconds });
      if (result.error || !result.workoutId) {
        setError(result.error ?? "Could not save cardio session.");
        return;
      }
      if (result.completedGoals && result.completedGoals.length > 0) {
        // Celebrate first; Continue proceeds to the workout detail.
        setCelebration({
          goals: result.completedGoals,
          workoutId: result.workoutId,
        });
        return;
      }
      router.push(`/history/${result.workoutId}`);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-center gap-8 py-6">
      <div className="text-center">
        <p className="text-lg font-semibold">{name}</p>
        <p className="label-mono mt-0.5">Target {targetMin} min</p>
      </div>

      <CircularStat
        pct={pct}
        size={240}
        strokeWidth={12}
        color={overtime ? "var(--chart-accent)" : "var(--accent)"}
      >
        <div className="text-center">
          <p
            className={`font-display text-5xl tabular-nums ${
              overtime ? "text-emerald-600 dark:text-emerald-400" : ""
            }`}
          >
            {overtime ? `+${fmt(-remaining)}` : fmt(remaining)}
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {overtime ? "overtime" : "remaining"} · {fmt(elapsed)} elapsed
          </p>
        </div>
      </CircularStat>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setTargetMin((m) => Math.max(5, m - 5))}
          disabled={targetMin <= 5}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          −5 min
        </button>
        <button
          type="button"
          onClick={() => setTargetMin((m) => m + 5)}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          +5 min
        </button>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex w-full max-w-sm flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleFinish}
          disabled={saving}
          className="btn-accent min-w-40 flex-1 px-4 py-3.5 text-sm sm:py-3"
        >
          {saving ? "Saving…" : "Finish & save"}
        </button>
        <button
          type="button"
          onClick={() => setConfirmExit(true)}
          disabled={saving}
          className="rounded-md border border-zinc-300 px-4 py-3.5 text-sm font-medium hover:bg-zinc-100 disabled:opacity-40 sm:py-3 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Exit
        </button>
      </div>

      {celebration && (
        <GoalCelebration
          goals={celebration.goals}
          onContinue={() => {
            router.push(`/history/${celebration.workoutId}`);
            router.refresh();
          }}
        />
      )}

      {confirmExit && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="discard-cardio-title"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onClick={() => setConfirmExit(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card flex w-full max-w-sm flex-col gap-4 p-5"
          >
            <div className="flex flex-col gap-1">
              <p id="discard-cardio-title" className="text-base font-semibold">
                Discard this session?
              </p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Your cardio time hasn&rsquo;t been saved. This can&rsquo;t be undone.
              </p>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setConfirmExit(false)}
                className="rounded-md border border-zinc-300 px-4 py-2.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                Keep going
              </button>
              <button
                type="button"
                onClick={() => {
                  router.push("/log");
                  router.refresh();
                }}
                className="rounded-md bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700"
              >
                Discard session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
