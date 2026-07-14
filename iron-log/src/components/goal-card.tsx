"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { deleteGoal } from "@/app/(app)/goals/actions";
import { CircularStat } from "@/components/circular-stat";
import { DeleteGoalButton } from "@/components/delete-goal-button";
import type { Goal, GoalProgress } from "@/lib/goals";

/**
 * One goal card. In-progress goals keep the % ring + Remove (confirm).
 * Achieved goals swap the ring for a pressable lime check that fades the
 * card away and deletes the goal. Missed goals (window ended, target not
 * hit) announce themselves, then auto-fade and delete with no interaction.
 */
export function GoalCard({
  goal,
  label,
  valueText,
  progress,
}: {
  goal: Goal;
  label: string;
  valueText: string;
  progress: GoalProgress;
}) {
  const router = useRouter();
  const [dismissing, setDismissing] = useState(false);
  const deletedRef = useRef(false);

  function dismiss() {
    if (deletedRef.current) return;
    setDismissing(true);
    // Let the fade play, then delete. Timeout (not onTransitionEnd) so
    // reduced-motion users — where the transition is instant — still work.
    setTimeout(async () => {
      if (deletedRef.current) return;
      deletedRef.current = true;
      await deleteGoal(goal.id);
      router.refresh();
    }, 500);
  }

  // Missed goals self-destruct: show the "GOAL MISSED" state briefly, then
  // play the same fade-out and delete. All setState happens in async
  // callbacks, never synchronously in the effect body.
  const missed = progress.missed;
  useEffect(() => {
    if (!missed) return;
    const showFor = setTimeout(() => {
      setDismissing(true);
      setTimeout(async () => {
        if (deletedRef.current) return;
        deletedRef.current = true;
        await deleteGoal(goal.id);
        router.refresh();
      }, 500);
    }, 1800);
    return () => clearTimeout(showFor);
    // Mount-only per goal: the card is replaced on refresh anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missed, goal.id]);

  return (
    <section
      className={`card flex items-center gap-4 p-4 motion-safe:transition-all motion-safe:duration-500 ${
        missed
          ? "ring-2 ring-red-500 motion-safe:animate-[goal-missed-shake_0.5s_ease-in-out_both] dark:ring-red-500"
          : progress.achieved
            ? "ring-2 ring-[var(--accent)]"
            : ""
      } ${dismissing ? "scale-95 opacity-0" : ""}`}
    >
      {missed ? (
        <span
          aria-hidden
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-red-600 text-2xl text-white"
        >
          ✕
        </span>
      ) : progress.achieved ? (
        <button
          type="button"
          onClick={dismiss}
          disabled={dismissing}
          aria-label={`Mark "${label}" done and clear it`}
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-2xl transition-transform hover:scale-105 active:scale-95"
          style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
        >
          ✓
        </button>
      ) : (
        <CircularStat pct={progress.pct} size={56} strokeWidth={5}>
          <span className="font-display text-sm">
            {Math.round(progress.pct * 100)}%
          </span>
        </CircularStat>
      )}
      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-sm font-semibold ${missed ? "line-through opacity-60" : ""}`}
        >
          {label}
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{valueText}</p>
        {missed ? (
          <p className="label-mono mt-0.5 text-red-600 dark:text-red-400">
            Goal missed
          </p>
        ) : progress.achieved ? (
          <p className="label-mono mt-0.5" style={{ color: "var(--accent-text)" }}>
            Achieved — tap ✓ to clear
          </p>
        ) : null}
      </div>
      {!progress.achieved && !missed && <DeleteGoalButton goalId={goal.id} />}
    </section>
  );
}
