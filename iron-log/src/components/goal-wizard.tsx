"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronDown, ListChecks } from "lucide-react";
import { createGoals } from "@/app/(app)/goals/actions";
import {
  goalLabel,
  suggestGoals,
  type SuggestedGoal,
  type WeekAnchor,
  type WizardAnswers,
} from "@/lib/goals";
import { unitToKg, type WeightUnit } from "@/lib/units";

const FREQ_OPTIONS: { value: WizardAnswers["frequency"]; label: string }[] = [
  { value: "2-3", label: "2–3 days" },
  { value: "3-4", label: "3–4 days" },
  { value: "5-6", label: "5–6 days" },
];
const OBJECTIVE_OPTIONS: { value: WizardAnswers["objective"]; label: string }[] = [
  { value: "cut", label: "Cut" },
  { value: "bulk", label: "Bulk" },
  { value: "maintain", label: "Maintain" },
  { value: "strength", label: "Build strength" },
  { value: "fitness", label: "General fitness" },
];
const CARDIO_OPTIONS: { value: WizardAnswers["cardio"]; label: string }[] = [
  { value: "none", label: "None" },
  { value: "light", label: "A little" },
  { value: "regular", label: "Regular" },
];

const suggestionKey = (s: SuggestedGoal) => `${s.metric}:${s.period}`;

function Pills<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
            value === o.value
              ? "border-transparent"
              : "border-zinc-300 text-zinc-600 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-100"
          }`}
          style={
            value === o.value
              ? { background: "var(--accent)", color: "var(--accent-ink)" }
              : undefined
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * "Help me choose": three quick questions -> a rule-based list of suggested
 * goals (volume anchored to the user's real recent weekly volume) the user
 * can approve. Deterministic, no AI.
 */
export function GoalWizard({
  avgWeeklyVolumeKg,
  unit,
}: {
  avgWeeklyVolumeKg: number | null;
  unit: WeightUnit;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [frequency, setFrequency] = useState<WizardAnswers["frequency"]>("3-4");
  const [objective, setObjective] = useState<WizardAnswers["objective"]>("maintain");
  const [cardio, setCardio] = useState<WizardAnswers["cardio"]>("light");
  const [weekAnchor, setWeekAnchor] = useState<WeekAnchor>("monday");
  const [unchecked, setUnchecked] = useState<Set<string>>(new Set());
  // Manual −/+ tweaks per suggestion; reset whenever an answer changes so
  // the list still recomputes from the questionnaire exactly as before.
  const [overrides, setOverrides] = useState<Map<string, number>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  // Answer setters clear manual tweaks — new answers, fresh suggestions.
  const answer = <T,>(set: (v: T) => void) => (v: T) => {
    setOverrides(new Map());
    set(v);
  };

  const suggestions = suggestGoals(
    { frequency, objective, cardio },
    { avgWeeklyVolumeKg, unit },
  ).map((s) => ({
    ...s,
    target: overrides.get(suggestionKey(s)) ?? s.target,
  }));
  const selected = suggestions.filter((s) => !unchecked.has(suggestionKey(s)));

  // Stepper increments (canonical units) and floors per metric.
  function stepFor(s: SuggestedGoal): { step: number; min: number } {
    if (s.metric === "volume") {
      const step = unitToKg(unit === "kg" ? 250 : 500, unit);
      return { step, min: step };
    }
    if (s.metric === "cardio_minutes") return { step: 15, min: 15 };
    if (s.period === "monthly") return { step: 2, min: 2 };
    return { step: 1, min: 1 };
  }

  function nudge(s: SuggestedGoal, direction: 1 | -1) {
    const { step, min } = stepFor(s);
    setOverrides((prev) => {
      const next = new Map(prev);
      next.set(suggestionKey(s), Math.max(min, s.target + direction * step));
      return next;
    });
  }

  function toggle(s: SuggestedGoal) {
    setUnchecked((prev) => {
      const next = new Set(prev);
      const key = suggestionKey(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleAdd() {
    setError(null);
    startSaving(async () => {
      const result = await createGoals(
        selected.map((s) => ({
          metric: s.metric,
          period: s.period,
          target: s.target,
          exerciseId: null,
          weekAnchor,
        })),
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setUnchecked(new Set());
      setOverrides(new Map());
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
          <ListChecks size={16} aria-hidden style={{ color: "var(--accent-text)" }} />
          <span className="text-sm font-semibold">Help me choose</span>
          <span className="hidden text-xs text-zinc-500 sm:inline dark:text-zinc-400">
            answer 3 questions, get suggested goals
          </span>
        </span>
        <ChevronDown
          size={16}
          aria-hidden
          className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium">How often do you want to train?</p>
            <Pills options={FREQ_OPTIONS} value={frequency} onChange={answer(setFrequency)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium">What&rsquo;s your main objective?</p>
            <Pills options={OBJECTIVE_OPTIONS} value={objective} onChange={answer(setObjective)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium">How much cardio?</p>
            <Pills options={CARDIO_OPTIONS} value={cardio} onChange={answer(setCardio)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium">Weekly window</p>
            <Pills
              options={[
                { value: "monday", label: "Starts Monday" },
                { value: "rolling", label: "Rolling 7 days" },
              ]}
              value={weekAnchor}
              onChange={setWeekAnchor}
            />
          </div>

          <div className="flex flex-col gap-1.5 border-t border-zinc-200 pt-3 dark:border-zinc-800">
            <p className="label-mono">Suggested goals</p>
            <ul className="flex flex-col gap-2">
              {suggestions.map((s) => {
                const key = suggestionKey(s);
                const checked = !unchecked.has(key);
                const label = goalLabel(
                  {
                    id: key,
                    metric: s.metric,
                    period: s.period,
                    target: s.target,
                    exerciseId: null,
                    createdAt: "1970-01-01", // label only — window unused
                    weekAnchor,
                  },
                  null,
                  unit,
                );
                return (
                  <li key={key} className="flex items-start gap-2.5">
                    <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(s)}
                        className="mt-1 h-4 w-4 accent-(--accent)"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{label}</span>
                        <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                          {s.reason}
                        </span>
                      </span>
                    </label>
                    <span className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => nudge(s, -1)}
                        aria-label={`Decrease target for ${label}`}
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-300 text-sm font-semibold hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                      >
                        −
                      </button>
                      <button
                        type="button"
                        onClick={() => nudge(s, 1)}
                        aria-label={`Increase target for ${label}`}
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-300 text-sm font-semibold hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                      >
                        +
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
            {avgWeeklyVolumeKg === null && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Log a few workouts and we can suggest a volume target too.
              </p>
            )}
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <button
            type="button"
            onClick={handleAdd}
            disabled={saving || selected.length === 0}
            className="btn-accent self-start px-4 py-2.5 text-sm disabled:opacity-50"
          >
            {saving
              ? "Adding…"
              : `Add ${selected.length} goal${selected.length === 1 ? "" : "s"}`}
          </button>
        </div>
      )}
    </section>
  );
}
