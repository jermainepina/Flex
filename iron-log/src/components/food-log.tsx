"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  addFoodEntry,
  deleteFoodEntry,
  logBodyWeight,
} from "@/app/(app)/log/food/actions";
import { MacroBars } from "@/components/macro-bars";
import {
  dailyTotals,
  MACROS,
  type FoodEntry,
  type NutritionTargets,
} from "@/lib/nutrition";
import { kgToUnit, unitToKg, type WeightUnit } from "@/lib/units";

export type FoodLogEntry = FoodEntry & { id: string; name: string | null };

// text-base on mobile so iOS doesn't auto-zoom focused inputs
const inputClass =
  "rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-base outline-none focus:border-(--accent) sm:text-sm dark:border-zinc-700";

const MACRO_FIELDS = MACROS.map((m) => ({
  key: m.key,
  placeholder: m.key === "calories" ? "kcal" : `${m.label.toLowerCase()} g`,
}));

function EntryRow({
  entry,
  onDeleted,
}: {
  entry: FoodLogEntry;
  onDeleted: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, startDeleting] = useTransition();

  return (
    <li className="flex items-center gap-3 rounded-xl border border-zinc-200 px-3 py-2.5 dark:border-zinc-800">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {entry.name ?? "Unnamed entry"}
        </span>
        <span className="block text-xs text-zinc-500 dark:text-zinc-400">
          {entry.calories} kcal · P {entry.proteinG} · C {entry.carbsG} · F{" "}
          {entry.fatG} · S {entry.sugarG}
        </span>
      </span>
      {confirming ? (
        <span className="flex items-center gap-1.5 text-sm">
          <button
            type="button"
            disabled={deleting}
            onClick={() =>
              startDeleting(async () => {
                await deleteFoodEntry(entry.id);
                onDeleted();
              })
            }
            className="rounded-md bg-red-600 px-2.5 py-1 font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {deleting ? "…" : "Yes"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={deleting}
            className="rounded-md border border-zinc-300 px-2.5 py-1 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            No
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          aria-label={`Delete ${entry.name ?? "entry"}`}
          className="text-sm text-zinc-400 hover:text-red-600"
        >
          ✕
        </button>
      )}
    </li>
  );
}

export function FoodLog({
  date,
  entries,
  targets,
  weighInKg,
  unit,
}: {
  date: string;
  entries: FoodLogEntry[];
  targets: NutritionTargets | null;
  weighInKg: number | null;
  unit: WeightUnit;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [weight, setWeight] = useState(
    weighInKg !== null
      ? String(Math.round(kgToUnit(weighInKg, unit) * 10) / 10)
      : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [weighError, setWeighError] = useState<string | null>(null);
  const [weighSaved, setWeighSaved] = useState(false);
  const [adding, startAdding] = useTransition();
  const [weighing, startWeighing] = useTransition();

  const totals = dailyTotals(entries);

  function handleAdd() {
    setError(null);
    const parsed = Object.fromEntries(
      MACRO_FIELDS.map((f) => [
        f.key,
        values[f.key]?.trim() ? parseFloat(values[f.key]) : 0,
      ]),
    );
    startAdding(async () => {
      const result = await addFoodEntry({
        date,
        name,
        calories: parsed.calories,
        proteinG: parsed.proteinG,
        carbsG: parsed.carbsG,
        fatG: parsed.fatG,
        sugarG: parsed.sugarG,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setName("");
      setValues({});
      router.refresh();
    });
  }

  function handleWeigh() {
    setWeighError(null);
    setWeighSaved(false);
    const w = parseFloat(weight);
    startWeighing(async () => {
      const result = await logBodyWeight({ date, weightKg: unitToKg(w, unit) });
      if (result.error) {
        setWeighError(result.error);
        return;
      }
      setWeighSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="card flex flex-col gap-3 p-4">
        <p className="label-mono">Day</p>
        <input
          type="date"
          value={date}
          onChange={(e) => {
            if (e.target.value) router.push(`/log/food?date=${e.target.value}`);
          }}
          className={`${inputClass} self-start`}
          aria-label="Food log date"
        />
      </section>

      <section className="card flex flex-col gap-3 p-4">
        <p className="label-mono">Totals</p>
        {targets ? (
          <MacroBars totals={totals} targets={targets} />
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No nutrition targets yet —{" "}
            <Link href="/goals" className="font-medium underline">
              set them on the Goals tab
            </Link>{" "}
            to see progress bars here.
          </p>
        )}
      </section>

      <section className="card flex flex-col gap-3 p-4">
        <p className="label-mono">Quick add</p>
        <input
          type="text"
          placeholder="Name (optional — e.g. Lunch)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {MACRO_FIELDS.map((f) => (
            <input
              key={f.key}
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              placeholder={f.placeholder}
              aria-label={f.placeholder}
              value={values[f.key] ?? ""}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, [f.key]: e.target.value }))
              }
              className={`${inputClass} px-2`}
            />
          ))}
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button
          type="button"
          onClick={handleAdd}
          disabled={adding}
          className="btn-accent self-start px-4 py-2.5 text-sm"
        >
          {adding ? "Adding…" : "Add entry"}
        </button>
      </section>

      {entries.length > 0 && (
        <section className="flex flex-col gap-2">
          <p className="label-mono">Logged</p>
          <ul className="flex flex-col gap-2">
            {entries.map((entry) => (
              <EntryRow key={entry.id} entry={entry} onDeleted={() => router.refresh()} />
            ))}
          </ul>
        </section>
      )}

      <section className="card flex flex-col gap-3 p-4">
        <p className="label-mono">Weigh-in</p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="number"
            min={0}
            step="any"
            inputMode="decimal"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className={`${inputClass} w-28`}
            aria-label={`Body weight in ${unit}`}
          />
          <span className="text-sm text-zinc-500 dark:text-zinc-400">{unit}</span>
          <button
            type="button"
            onClick={handleWeigh}
            disabled={weighing || weight.trim() === ""}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            {weighing ? "Saving…" : weighInKg !== null ? "Update" : "Save"}
          </button>
          {weighSaved && !weighError && (
            <span className="text-sm text-emerald-600 dark:text-emerald-400">
              Saved.
            </span>
          )}
        </div>
        {weighError && (
          <p className="text-sm text-red-600 dark:text-red-400">{weighError}</p>
        )}
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          One weigh-in per day — it feeds the bodyweight trend in Stats.
        </p>
      </section>
    </div>
  );
}
