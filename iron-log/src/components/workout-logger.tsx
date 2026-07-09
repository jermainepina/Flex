"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  createExercise,
  getExerciseBests,
  getPreviousPerformance,
  saveWorkout,
  type WorkoutPayload,
} from "@/app/(app)/log/actions";
import { PrChip } from "@/components/pr-chip";
import { LogSessionBar, type LogSessionBarHandle } from "@/components/rest-timer";
import { computePrFlags, type ExerciseBests } from "@/lib/pr";
import {
  guessMuscleGroup,
  MUSCLE_GROUP_LABELS,
  MUSCLE_GROUPS,
  type Exercise,
  type MuscleGroup,
  type PreviousPerformance,
} from "@/lib/types";
import { formatWeight, kgToUnit, unitToKg, type WeightUnit } from "@/lib/units";

const NEW_EXERCISE = "__new__";

type SetRow = { weight: string; reps: string; done: boolean };

type Entry = {
  key: number;
  exerciseId: string;
  notes: string;
  sets: SetRow[];
  showNewInput: boolean;
  newName: string;
  newGroup: MuscleGroup;
  newGroupTouched: boolean;
  prev: PreviousPerformance | null;
  prevLoading: boolean;
  bests: ExerciseBests | null;
};

export type InitialTemplate = {
  id: string;
  name: string;
  entries: {
    exerciseId: string;
    sets: number;
    notes: string | null;
    weightsKg: (number | null)[]; // per set; null = leave blank
  }[];
};

let nextKey = 0;

function makeEntry(exerciseId = "", setCount = 1, notes = "", weights: string[] = []): Entry {
  return {
    key: nextKey++,
    exerciseId,
    notes,
    sets: Array.from({ length: Math.max(1, setCount) }, (_, i) => ({
      weight: weights[i] ?? "",
      reps: "",
      done: false,
    })),
    showNewInput: false,
    newName: "",
    newGroup: "other",
    newGroupTouched: false,
    prev: null,
    // Pre-selected (template) entries start in loading state; the mount
    // effect fetches their prev/bests asynchronously.
    prevLoading: exerciseId !== "",
    bests: null,
  };
}

// Local date as YYYY-MM-DD (en-CA locale formats exactly that way).
function today() {
  return new Date().toLocaleDateString("en-CA");
}

// text-base on mobile so iOS doesn't auto-zoom focused inputs
const inputClass =
  "rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-base outline-none focus:border-(--accent) sm:text-sm dark:border-zinc-700";

export function WorkoutLogger({
  initialExercises,
  unit,
  initialTemplate = null,
}: {
  initialExercises: Exercise[];
  unit: WeightUnit;
  initialTemplate?: InitialTemplate | null;
}) {
  const router = useRouter();
  const [exercises, setExercises] = useState(initialExercises);
  const [entries, setEntries] = useState<Entry[]>(() =>
    initialTemplate
      ? initialTemplate.entries.map((e) =>
          makeEntry(
            e.exerciseId,
            e.sets,
            e.notes ?? "",
            e.weightsKg.map((w) =>
              w === null ? "" : String(Math.round(kgToUnit(w, unit) * 10) / 10),
            ),
          ),
        )
      : [makeEntry()],
  );
  const [date, setDate] = useState(today);
  const [name, setName] = useState(initialTemplate?.name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  // Session start is captured in an effect (render must stay pure); the bar
  // owns the visible clocks and exposes startRest() for the done checkmarks.
  const startedAtRef = useRef<number | null>(null);
  const barRef = useRef<LogSessionBarHandle>(null);
  useEffect(() => {
    startedAtRef.current = Date.now();
  }, []);

  // Template-prefilled entries need their previous-performance + PR bests
  // loaded, same as a manual selection would (they mount with
  // prevLoading=true; all setState here happens in async callbacks).
  useEffect(() => {
    for (const entry of entries) {
      if (!entry.exerciseId || entry.bests || !entry.prevLoading) continue;
      Promise.all([
        getPreviousPerformance(entry.exerciseId),
        getExerciseBests(entry.exerciseId),
      ])
        .then(([prev, bests]) =>
          updateEntry(entry.key, { prev, bests, prevLoading: false }),
        )
        .catch(() => updateEntry(entry.key, { prevLoading: false }));
    }
    // Mount-only: hydrate the template's pre-selected exercises.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      bests: null,
    });
    Promise.all([getPreviousPerformance(exerciseId), getExerciseBests(exerciseId)])
      .then(([prev, bests]) => updateEntry(key, { prev, bests, prevLoading: false }))
      .catch(() => updateEntry(key, { prevLoading: false }));
  }

  // Live PR flags for the gold outline/chips — same rules the server persists.
  function livePrFlags(entry: Entry): boolean[] {
    if (!entry.bests || !entry.exerciseId) return entry.sets.map(() => false);
    const parsed = entry.sets.map((s) => ({
      weightKg: unitToKg(parseFloat(s.weight), unit),
      reps: parseInt(s.reps, 10),
    }));
    // Only fully-valid rows participate; map flags back to row positions.
    const validIdx: number[] = [];
    const validSets = parsed.filter((p, i) => {
      const ok = Number.isFinite(p.weightKg) && p.weightKg >= 0 && Number.isInteger(p.reps) && p.reps >= 1;
      if (ok) validIdx.push(i);
      return ok;
    });
    const flags = computePrFlags(validSets, entry.bests);
    const out = entry.sets.map(() => false);
    flags.forEach((f, j) => {
      out[validIdx[j]] = f;
    });
    return out;
  }

  async function confirmNewExercise(entry: Entry) {
    setError(null);
    const result = await createExercise(entry.newName, entry.newGroup);
    if (result.error || !result.data) {
      setError(result.error ?? "Could not create exercise.");
      return;
    }
    const created = result.data;
    setExercises((prev) =>
      [...prev, created].sort((a, b) => a.name.localeCompare(b.name)),
    );
    updateEntry(entry.key, { newName: "", newGroupTouched: false });
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
      sets: [
        ...entry.sets,
        { weight: last?.weight ?? "", reps: last?.reps ?? "", done: false },
      ],
    });
  }

  function toggleDone(entry: Entry, index: number) {
    const nowDone = !entry.sets[index].done;
    updateSet(entry.key, index, { done: nowDone });
    if (nowDone) barRef.current?.startRest();
  }

  function removeSet(entry: Entry, index: number) {
    updateEntry(entry.key, { sets: entry.sets.filter((_, i) => i !== index) });
  }

  function handleSave() {
    setError(null);

    const payload: WorkoutPayload = {
      date,
      name,
      durationSeconds: startedAtRef.current
        ? Math.round((Date.now() - startedAtRef.current) / 1000)
        : 0,
      templateId: initialTemplate?.id ?? null,
      exercises: [],
    };
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
      if (result.error || !result.workoutId) {
        setError(result.error ?? "Could not save workout.");
        return;
      }
      router.push(`/history/${result.workoutId}/summary`);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="card flex flex-col gap-3 p-4">
        <p className="label-mono">Session info</p>
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
          <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm font-medium">
            Workout name
            <input
              type="text"
              placeholder="e.g. Push Day (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>
      </section>

      {entries.map((entry, entryIndex) => {
        const prFlags = livePrFlags(entry);
        const hasPr = prFlags.some(Boolean);
        return (
        <section
          key={entry.key}
          className={`card flex flex-col gap-4 p-4 transition-shadow ${
            hasPr
              ? "ring-2 ring-amber-400 dark:ring-amber-500"
              : "focus-within:ring-2 focus-within:ring-[var(--accent)]"
          }`}
        >
          <div className="flex items-end justify-between gap-3">
            <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm font-medium">
              <span className="label-mono">Exercise {entryIndex + 1}</span>
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
                className={`${inputClass} bg-white dark:bg-zinc-950`}
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
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                placeholder="e.g. Bench Press"
                value={entry.newName}
                onChange={(e) =>
                  updateEntry(entry.key, {
                    newName: e.target.value,
                    // Follow the keyword guess until the user picks manually.
                    ...(entry.newGroupTouched
                      ? {}
                      : { newGroup: guessMuscleGroup(e.target.value) }),
                  })
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    confirmNewExercise(entry);
                  }
                }}
                className={`${inputClass} min-w-40 flex-1`}
                autoFocus
              />
              <select
                value={entry.newGroup}
                onChange={(e) =>
                  updateEntry(entry.key, {
                    newGroup: e.target.value as MuscleGroup,
                    newGroupTouched: true,
                  })
                }
                aria-label="Muscle group"
                className={`${inputClass} bg-white dark:bg-zinc-950`}
              >
                {MUSCLE_GROUPS.map((g) => (
                  <option key={g} value={g}>
                    {MUSCLE_GROUP_LABELS[g]}
                  </option>
                ))}
              </select>
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
            <div className="grid grid-cols-[4rem_1fr_1fr_2.5rem_2.5rem] items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              <span>Set</span>
              <span>Weight ({unit})</span>
              <span>Reps</span>
              <span className="text-center">Done</span>
              <span />
            </div>
            {entry.sets.map((set, setIndex) => (
              <div
                key={setIndex}
                className="grid grid-cols-[4rem_1fr_1fr_2.5rem_2.5rem] items-center gap-2"
              >
                <span className="flex items-center gap-1 text-sm text-zinc-500 dark:text-zinc-400">
                  {setIndex + 1}
                  {prFlags[setIndex] && <PrChip />}
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
                  className={`${inputClass} ${set.done ? "opacity-60" : ""}`}
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
                  className={`${inputClass} ${set.done ? "opacity-60" : ""}`}
                />
                <button
                  type="button"
                  onClick={() => toggleDone(entry, setIndex)}
                  aria-label={`Mark set ${setIndex + 1} ${set.done ? "not done" : "done"}`}
                  aria-pressed={set.done}
                  className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full border text-sm transition-colors sm:h-8 sm:w-8 ${
                    set.done
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-zinc-300 text-zinc-400 hover:border-emerald-500 hover:text-emerald-600 dark:border-zinc-700"
                  }`}
                >
                  ✓
                </button>
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
        );
      })}

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
        className="btn-accent px-4 py-3.5 text-sm sm:py-3"
      >
        {saving ? "Saving…" : "Save workout"}
      </button>

      <LogSessionBar handleRef={barRef} />
    </div>
  );
}
