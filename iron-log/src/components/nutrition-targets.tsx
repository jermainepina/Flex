"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronDown, UtensilsCrossed } from "lucide-react";
import { saveNutritionGoals } from "@/app/(app)/goals/actions";
import {
  MACROS,
  suggestNutrition,
  type MacroKey,
  type NutritionObjective,
  type NutritionTargets as Targets,
} from "@/lib/nutrition";

const OBJECTIVES: { value: NutritionObjective; label: string }[] = [
  { value: "cut", label: "Cut" },
  { value: "maintain", label: "Maintain" },
  { value: "bulk", label: "Bulk" },
];

// text-base on mobile so iOS doesn't auto-zoom focused inputs
const inputClass =
  "rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-base outline-none focus:border-(--accent) sm:text-sm dark:border-zinc-700";

export function NutritionTargets({
  initial,
  weightKg,
  heightCm,
  birthYear,
  sex,
  sessionsPerWeek,
  currentYear,
}: {
  initial: Targets | null;
  weightKg: number | null;
  heightCm: number | null;
  birthYear: number | null;
  sex: "male" | "female" | null;
  sessionsPerWeek: number;
  currentYear: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [objective, setObjective] = useState<NutritionObjective>("maintain");
  const [values, setValues] = useState<Record<MacroKey, string>>({
    calories: initial ? String(initial.calories) : "",
    proteinG: initial ? String(initial.proteinG) : "",
    carbsG: initial ? String(initial.carbsG) : "",
    fatG: initial ? String(initial.fatG) : "",
    sugarG: initial ? String(initial.sugarG) : "",
  });
  const [suggestNote, setSuggestNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, startSaving] = useTransition();

  function applySuggestion() {
    if (weightKg === null) return;
    const s = suggestNutrition({
      weightKg,
      heightCm,
      birthYear,
      sex,
      sessionsPerWeek,
      objective,
      currentYear,
    });
    setValues({
      calories: String(s.calories),
      proteinG: String(s.proteinG),
      carbsG: String(s.carbsG),
      fatG: String(s.fatG),
      sugarG: String(s.sugarG),
    });
    setSuggestNote(
      s.method === "mifflin"
        ? `Based on your body stats, real training frequency (~${Math.round(sessionsPerWeek * 10) / 10} sessions/week), and a ${objective} goal. Tweak anything before saving.`
        : "Rough estimate from weight + training frequency — add height, birth year, and sex in your profile for a more precise one.",
    );
  }

  function handleSave() {
    setError(null);
    setSaved(false);
    const parsed = Object.fromEntries(
      MACROS.map((m) => [m.key, parseFloat(values[m.key] || "0")]),
    ) as Targets;
    startSaving(async () => {
      const result = await saveNutritionGoals(parsed);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSaved(true);
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
          <UtensilsCrossed
            size={16}
            aria-hidden
            style={{ color: "var(--accent-text)" }}
          />
          <span className="text-sm font-semibold">Nutrition targets</span>
          <span className="hidden text-xs text-zinc-500 sm:inline dark:text-zinc-400">
            {initial ? "daily macros — tap to edit" : "set daily macros"}
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
          <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
            <p className="text-sm font-medium">Suggest for me</p>
            <div className="flex flex-wrap items-center gap-2">
              {OBJECTIVES.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setObjective(o.value)}
                  aria-pressed={objective === o.value}
                  className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                    objective === o.value
                      ? "border-transparent"
                      : "border-zinc-300 text-zinc-600 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-100"
                  }`}
                  style={
                    objective === o.value
                      ? { background: "var(--accent)", color: "var(--accent-ink)" }
                      : undefined
                  }
                >
                  {o.label}
                </button>
              ))}
              <button
                type="button"
                onClick={applySuggestion}
                disabled={weightKg === null}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                Suggest
              </button>
            </div>
            {weightKg === null && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Log your weight in your profile first so suggestions have
                something to work with.
              </p>
            )}
            {suggestNote && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{suggestNote}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {MACROS.map((m) => (
              <label key={m.key} className="flex flex-col gap-1 text-sm font-medium">
                {m.label}
                <span className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={values[m.key]}
                    onChange={(e) =>
                      setValues((prev) => ({ ...prev, [m.key]: e.target.value }))
                    }
                    className={`${inputClass} w-full px-2`}
                  />
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {m.unit}
                  </span>
                </span>
                {m.direction === "under" && (
                  <span className="text-[10px] font-normal text-zinc-500 dark:text-zinc-400">
                    stay under
                  </span>
                )}
              </label>
            ))}
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          {saved && !error && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">Saved.</p>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn-accent self-start px-4 py-2.5 text-sm"
          >
            {saving ? "Saving…" : "Save targets"}
          </button>
        </div>
      )}
    </section>
  );
}
