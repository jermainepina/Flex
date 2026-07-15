"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { createGoal } from "@/app/(app)/goals/actions";
import type { GoalMetric, GoalPeriod, WeekAnchor } from "@/lib/goals";
import type { Exercise } from "@/lib/types";
import { unitToKg, type WeightUnit } from "@/lib/units";

const METRIC_OPTIONS: { value: GoalMetric; label: string }[] = [
  { value: "sessions", label: "Workouts per week/month" },
  { value: "volume", label: "Total volume per week/month" },
  { value: "exercise_weight", label: "Exercise weight target" },
  { value: "cardio_minutes", label: "Cardio minutes per week/month" },
];

// text-base on mobile so iOS doesn't auto-zoom focused inputs
const inputClass =
  "rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-base outline-none focus:border-(--accent) sm:text-sm dark:border-zinc-700";

export function GoalForm({
  exercises,
  unit,
}: {
  exercises: Exercise[];
  unit: WeightUnit;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [metric, setMetric] = useState<GoalMetric>("sessions");
  const [period, setPeriod] = useState<GoalPeriod>("weekly");
  const [weekAnchor, setWeekAnchor] = useState<WeekAnchor>("monday");
  const [exerciseId, setExerciseId] = useState("");
  const [target, setTarget] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const isWeight = metric === "exercise_weight";
  const targetUnit =
    metric === "sessions" ? "sessions" : metric === "cardio_minutes" ? "min" : unit;

  function handleAdd() {
    setError(null);
    const n = parseFloat(target);
    if (!Number.isFinite(n) || n <= 0) {
      setError("Enter a target above zero.");
      return;
    }
    const canonical =
      metric === "volume" || metric === "exercise_weight" ? unitToKg(n, unit) : n;
    startSaving(async () => {
      const result = await createGoal({
        metric,
        period: isWeight ? null : period,
        target: canonical,
        exerciseId: isWeight ? exerciseId || null : null,
        weekAnchor,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setTarget("");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <section className="card flex flex-col p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center justify-between gap-3 text-left"
      >
        <span className="flex items-center gap-2">
          <Plus size={16} aria-hidden style={{ color: "var(--accent-text)" }} />
          <span className="text-sm font-semibold">New goal</span>
          <span className="hidden text-xs text-zinc-500 sm:inline dark:text-zinc-400">
            set a custom target yourself
          </span>
        </span>
        <ChevronDown
          size={16}
          aria-hidden
          className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="mt-4 flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm font-medium">
          Goal type
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value as GoalMetric)}
            className={`${inputClass} bg-white dark:bg-zinc-950`}
          >
            {METRIC_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>

        {isWeight ? (
          <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm font-medium">
            Exercise
            <select
              value={exerciseId}
              onChange={(e) => setExerciseId(e.target.value)}
              className={`${inputClass} bg-white dark:bg-zinc-950`}
            >
              <option value="">Select exercise…</option>
              {exercises.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="flex flex-wrap gap-4">
            <div className="flex flex-col gap-1 text-sm font-medium">
              Period
              <div className="flex gap-1 self-start rounded-lg border border-zinc-200 p-1 dark:border-zinc-800">
                {(["weekly", "monthly"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPeriod(p)}
                    aria-pressed={period === p}
                    className={`rounded-md px-4 py-1.5 text-sm font-semibold ${
                      period === p
                        ? "bg-(--accent) text-(--accent-ink)"
                        : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {p === "weekly" ? "Weekly" : "Monthly"}
                  </button>
                ))}
              </div>
            </div>
            {period === "weekly" && (
              <div className="flex flex-col gap-1 text-sm font-medium">
                Week window
                <div className="flex gap-1 self-start rounded-lg border border-zinc-200 p-1 dark:border-zinc-800">
                  {(
                    [
                      { value: "monday", label: "Starts Monday" },
                      { value: "rolling", label: "Rolling 7 days" },
                    ] as const
                  ).map((a) => (
                    <button
                      key={a.value}
                      type="button"
                      onClick={() => setWeekAnchor(a.value)}
                      aria-pressed={weekAnchor === a.value}
                      className={`rounded-md px-4 py-1.5 text-sm font-semibold ${
                        weekAnchor === a.value
                          ? "bg-(--accent) text-(--accent-ink)"
                          : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                      }`}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <label className="flex w-36 flex-col gap-1 text-sm font-medium">
          Target
          <span className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              step="any"
              inputMode="decimal"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd();
                }
              }}
              className={`${inputClass} w-24`}
            />
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {targetUnit}
            </span>
          </span>
        </label>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <button
        type="button"
        onClick={handleAdd}
        disabled={saving}
        className="btn-accent self-start px-4 py-2.5 text-sm"
      >
        {saving ? "Adding…" : "Add goal"}
      </button>
        </div>
      )}
    </section>
  );
}
