"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateSettings } from "@/app/(app)/settings/actions";
import { THEMES, type Theme } from "@/lib/types";
import { type WeightUnit } from "@/lib/units";

const THEME_LABELS: Record<Theme, string> = {
  light: "Light",
  dim: "Dim",
  dark: "Dark",
};

// text-base on mobile so iOS doesn't auto-zoom focused inputs
const inputClass =
  "rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-base outline-none focus:border-(--accent) sm:text-sm dark:border-zinc-700";

function applyThemeClass(theme: Theme) {
  const el = document.documentElement;
  el.classList.toggle("dark", theme !== "light");
  el.classList.toggle("theme-dim", theme === "dim");
}

export function SettingsForm({
  initialName,
  initialTheme,
  initialUnit,
}: {
  initialName: string;
  initialTheme: Theme;
  initialUnit: WeightUnit;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialName);
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [unit, setUnit] = useState<WeightUnit>(initialUnit);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, startSaving] = useTransition();

  function handleSave() {
    setError(null);
    setSaved(false);
    startSaving(async () => {
      const result = await updateSettings({
        displayName,
        theme,
        preferredUnit: unit,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="flex max-w-md flex-col gap-6">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Name
        <input
          type="text"
          placeholder="How should we greet you?"
          maxLength={50}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className={inputClass}
        />
      </label>

      <div className="flex flex-col gap-1 text-sm font-medium">
        Theme
        <div className="flex gap-1 self-start rounded-lg border border-zinc-200 p-1 dark:border-zinc-800">
          {THEMES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTheme(t);
                // Instant preview; persisted on Save.
                applyThemeClass(t);
              }}
              aria-pressed={theme === t}
              className={`rounded-md px-4 py-1.5 text-sm font-semibold ${
                theme === t
                  ? "bg-(--accent) text-(--accent-ink)"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              {THEME_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Weight unit
        <select
          value={unit}
          onChange={(e) => setUnit(e.target.value as WeightUnit)}
          className={`${inputClass} self-start bg-white dark:bg-zinc-950`}
        >
          <option value="lb">Pounds (lb)</option>
          <option value="kg">Kilograms (kg)</option>
        </select>
        <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
          Weights are stored in kg and shown in your unit everywhere.
        </span>
      </label>

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
        {saving ? "Saving…" : "Save settings"}
      </button>
    </div>
  );
}
