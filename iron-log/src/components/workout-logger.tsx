"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createExercise,
  getPreviousPerformance,
  saveWorkout,
  type WorkoutPayload,
} from "@/app/(app)/log/actions";
import {
  WORKOUT_TYPES,
  WORKOUT_TYPE_LABELS,
  type Exercise,
  type PreviousPerformance,
  type WorkoutType,
} from "@/lib/types";
import { formatWeight, unitToKg, type WeightUnit } from "@/lib/units";

const NEW_EXERCISE = "__new__";

type SetRow = { weight: string; reps: string };

type Entry = {
  key: number;
  exerciseId: string;
  notes: string;
  sets: SetRow[];
  showNewInput: boolean;
  newName: string;
  prev: PreviousPerformance | null;
  prevLoading: boolean;
};

let nextKey = 0;

function makeEntry(): Entry {
  return {
    key: nextKey++,
    exerciseId: "",
    notes: "",
    sets: [{ weight: "", reps: "" }],
    showNewInput: false,
    newName: "",
    prev: null,
    prevLoading: false,
  };
}

// Local date as YYYY-MM-DD (en-CA locale formats exactly that way).
function today() {
  return new Date().toLocaleDateString("en-CA");
}

const inputClass =
  "rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700";

export function WorkoutLogger({
  initialExercises,
  unit,
}: {
  initialExercises: Exercise[];
  unit: WeightUnit;
}) {
  const router = useRouter();
  const [exercises, setExercises] = useState(initialExercises);
  const [entries, setEntries] = useState<Entry[]>([makeEntry()]);
  const [date, setDate] = useState(today);
  const [type, setType] = useState<WorkoutType>("other");
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  function updateEntry(key: number, patch: Partial<Entry>) {
    setEntries((prev) =>
      prev.map((e) => (e.key === key ? { ...e, ...patch } : e)),
    );
  }

  function selectExercise(key: number, exerciseId: string) {
    updateEntry(key, {
      exerciseId,
      showNewInput: false,
      prev: null,
      prevLoading: true,
    });
    getPreviousPerformance(exerciseId)
      .then((prev) => updateEntry(key, { prev, prevLoading: false }))
      .catch(() => updateEntry(key, { prevLoading: false }));
  }

  async function confirmNewExercise(entry: Entry) {
    setError(null);
    const result = await createExercise(entry.newName);
    if (result.error || !result.data) {
      setError(result.error ?? "Could not create exercise.");
      return;
    }
    const created = result.data;
    setExercises((prev) =>
      [...prev, created].sort((a, b) => a.name.localeCompare(b.name)),
    );
    updateEntry(entry.key, { newName: "" });
    selectExercise(entry.key, created.id);
  }

  function updateSet(key: number, index: number, patch: Partial<SetRow>) {
    setEntries((prev) =>
      prev.map((e) =>
        e.key === key
          ? {
              ...e,
              sets: e.sets.map((s, i) => (i === index ? { ...s, ...patch } : s)),
            }
          : e,
      ),
    );
  }

  function addSet(entry: Entry) {
    const last = entry.sets[entry.sets.length - 1];
    updateEntry(entry.key, {
      sets: [...entry.sets, { weight: last?.weight ?? "", reps: last?.reps ?? "" }],
    });
  }

  function removeSet(entry: Entry, index: number) {
    updateEntry(entry.key, { sets: entry.sets.filter((_, i) => i !== index) });
  }

  function handleSave() {
    setError(null);

    const payload: WorkoutPayload = { date, type, exercises: [] };
    for (const entry of entries) {
      if (!entry.exerciseId) {
        setError("Select an exercise for every entry (or remove empty ones).");
        return;
      }
      const sets = [];
      for (const set of entry.sets) {
        const weight = parseFloat(set.weight);
        const reps = parseInt(set.reps, 10);
        if (!Number.isFinite(weight) || weight < 0) {
          setError("Every set needs a weight (0 is fine for bodyweight).");
          return;
        }
        if (!Number.isInteger(reps) || reps < 1) {
          setError("Every set needs at least 1 rep.");
          return;
        }
        sets.push({ weightKg: unitToKg(weight, unit), reps });
      }
      if (sets.length === 0) {
        setError("Every exercise needs at least one set.");
        return;
      }
      payload.exercises.push({
        exerciseId: entry.exerciseId,
        notes: entry.notes,
        sets,
      });
    }
    if (payload.exercises.length === 0) {
      setError("Add at least one exercise.");
      return;
    }

    startSaving(async () => {
      const result = await saveWorkout(payload);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Date
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Type
          <select
            value={type}
            onChange={(e) => setType(e.target.value as WorkoutType)}
            className={inputClass}
          >
            {WORKOUT_TYPES.map((t) => (
              <option key={t} value={t}>
                {WORKOUT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {entries.map((entry, entryIndex) => (
        <section
          key={entry.key}
          className="flex flex-col gap-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
        >
          <div className="flex items-end justify-between gap-3">
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-medium">
              Exercise {entryIndex + 1}
              <select
                value={entry.showNewInput ? NEW_EXERCISE : entry.exerciseId}
                onChange={(e) => {
                  if (e.target.value === NEW_EXERCISE) {
                    updateEntry(entry.key, { showNewInput: true });
                  } else if (e.target.value) {
                    selectExercise(entry.key, e.target.value);
                  } else {
                    updateEntry(entry.key, { exerciseId: "", prev: null });
                  }
                }}
                className={inputClass}
              >
                <option value="">Select exercise…</option>
                {exercises.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name}
                  </option>
                ))}
                <option value={NEW_EXERCISE}>+ New exercise…</option>
              </select>
            </label>
            {entries.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setEntries((prev) => prev.filter((e) => e.key !== entry.key))
                }
                className="pb-2 text-sm text-zinc-500 hover:text-red-600 dark:text-zinc-400"
              >
                Remove
              </button>
            )}
          </div>

          {entry.showNewInput && (
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. Bench Press"
                value={entry.newName}
                onChange={(e) => updateEntry(entry.key, { newName: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    confirmNewExercise(entry);
                  }
                }}
                className={`${inputClass} flex-1`}
                autoFocus
              />
              <button
                type="button"
                onClick={() => confirmNewExercise(entry)}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                Create
              </button>
            </div>
          )}

          {entry.prevLoading && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Loading previous performance…
            </p>
          )}
          {entry.prev && (
            <p className="rounded-md bg-zinc-100 px-3 py-2 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              Last time (
              {new Date(entry.prev.workoutDate).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
              ):{" "}
              {entry.prev.sets
                .map((s) => `${formatWeight(s.weight, unit)} × ${s.reps}`)
                .join(", ")}
              {entry.prev.notes ? ` — “${entry.prev.notes}”` : ""}
            </p>
          )}

          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-[2.5rem_1fr_1fr_2.5rem] items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              <span>Set</span>
              <span>Weight ({unit})</span>
              <span>Reps</span>
              <span />
            </div>
            {entry.sets.map((set, setIndex) => (
              <div
                key={setIndex}
                className="grid grid-cols-[2.5rem_1fr_1fr_2.5rem] items-center gap-2"
              >
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                  {setIndex + 1}
                </span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  value={set.weight}
                  onChange={(e) =>
                    updateSet(entry.key, setIndex, { weight: e.target.value })
                  }
                  className={inputClass}
                />
                <input
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  value={set.reps}
                  onChange={(e) =>
                    updateSet(entry.key, setIndex, { reps: e.target.value })
                  }
                  className={inputClass}
                />
                {entry.sets.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeSet(entry, setIndex)}
                    aria-label={`Remove set ${setIndex + 1}`}
                    className="text-sm text-zinc-400 hover:text-red-600"
                  >
                    ✕
                  </button>
                ) : (
                  <span />
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => addSet(entry)}
              className="self-start text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              + Add set
            </button>
          </div>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Notes
            <textarea
              rows={2}
              placeholder="Optional — form cues, how it felt…"
              value={entry.notes}
              onChange={(e) => updateEntry(entry.key, { notes: e.target.value })}
              className={inputClass}
            />
          </label>
        </section>
      ))}

      <button
        type="button"
        onClick={() => setEntries((prev) => [...prev, makeEntry()])}
        className="self-start rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        + Add exercise
      </button>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {saving ? "Saving…" : "Save workout"}
      </button>
    </div>
  );
}
