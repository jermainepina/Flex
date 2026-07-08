"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createExercise } from "@/app/(app)/log/actions";
import { saveTemplate } from "@/app/(app)/templates/actions";
import {
  guessMuscleGroup,
  MUSCLE_GROUP_LABELS,
  MUSCLE_GROUPS,
  type Exercise,
  type MuscleGroup,
} from "@/lib/types";
import { kgToUnit, unitToKg, type WeightUnit } from "@/lib/units";

const NEW_EXERCISE = "__new__";

type EditorRow = {
  key: number;
  exerciseId: string;
  sets: string;
  notes: string;
  weights: string[]; // display-unit strings, "" = no suggestion
};

let nextKey = 0;

const inputClass =
  "rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700";

export type TemplateEditorInitial = {
  id: string;
  name: string;
  entries: {
    exerciseId: string;
    sets: number;
    notes: string | null;
    weightsKg: (number | null)[];
  }[];
};

/** Resize the weights array to n, preserving existing values. */
function resizeWeights(weights: string[], n: number): string[] {
  return Array.from({ length: Math.max(0, n) }, (_, i) => weights[i] ?? "");
}

function SortableRow({
  row,
  name,
  unit,
  onChange,
  onRemove,
}: {
  row: EditorRow;
  name: string;
  unit: WeightUnit;
  onChange: (patch: Partial<EditorRow>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: row.key });
  const setCount = parseInt(row.sets, 10);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950 ${
        isDragging ? "z-10 shadow-md ring-2 ring-zinc-400 dark:ring-zinc-500" : ""
      }`}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${name}`}
          className="cursor-grab touch-none text-zinc-400 hover:text-zinc-600 active:cursor-grabbing dark:hover:text-zinc-300"
        >
          ≡
        </button>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{name}</span>
        <label className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          Sets
          <input
            type="number"
            min={1}
            max={20}
            step={1}
            inputMode="numeric"
            value={row.sets}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              onChange({
                sets: e.target.value,
                weights: Number.isInteger(n)
                  ? resizeWeights(row.weights, Math.min(20, Math.max(1, n)))
                  : row.weights,
              });
            }}
            className={`${inputClass} w-16 px-2 py-1.5`}
          />
        </label>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${name}`}
          className="text-sm text-zinc-400 hover:text-red-600"
        >
          ✕
        </button>
      </div>

      <input
        type="text"
        placeholder="Notes (optional — shown when using this template)"
        value={row.notes}
        onChange={(e) => onChange({ notes: e.target.value })}
        className={`${inputClass} px-2 py-1.5 text-xs`}
      />

      {Number.isInteger(setCount) && setCount >= 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Weight ({unit}, optional)
          </span>
          {row.weights.map((w, i) => (
            <input
              key={i}
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              placeholder={`Set ${i + 1}`}
              aria-label={`${name} set ${i + 1} weight`}
              value={w}
              onChange={(e) => {
                const weights = [...row.weights];
                weights[i] = e.target.value;
                onChange({ weights });
              }}
              className={`${inputClass} w-20 px-2 py-1.5 text-xs`}
            />
          ))}
        </div>
      )}
    </li>
  );
}

export function TemplateEditor({
  exercises: initialExercises,
  unit,
  initial,
}: {
  exercises: Exercise[];
  unit: WeightUnit;
  initial?: TemplateEditorInitial;
}) {
  const router = useRouter();
  const [exercises, setExercises] = useState(initialExercises);
  const [name, setName] = useState(initial?.name ?? "");
  const [rows, setRows] = useState<EditorRow[]>(
    () =>
      initial?.entries.map((e) => ({
        key: nextKey++,
        exerciseId: e.exerciseId,
        sets: String(e.sets),
        notes: e.notes ?? "",
        weights: resizeWeights(
          e.weightsKg.map((w) =>
            w === null ? "" : String(Math.round(kgToUnit(w, unit) * 10) / 10),
          ),
          e.sets,
        ),
      })) ?? [],
  );
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newGroup, setNewGroup] = useState<MuscleGroup>("other");
  const [newGroupTouched, setNewGroupTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const nameOf = new Map(exercises.map((e) => [e.id, e.name]));

  function addRow(exerciseId: string) {
    setRows((prev) => [
      ...prev,
      {
        key: nextKey++,
        exerciseId,
        sets: "3",
        notes: "",
        weights: ["", "", ""],
      },
    ]);
  }

  async function confirmNewExercise() {
    setError(null);
    const result = await createExercise(newName, newGroup);
    if (result.error || !result.data) {
      setError(result.error ?? "Could not create exercise.");
      return;
    }
    const created = result.data;
    setExercises((prev) =>
      [...prev, created].sort((a, b) => a.name.localeCompare(b.name)),
    );
    setNewName("");
    setShowNew(false);
    setNewGroupTouched(false);
    addRow(created.id);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setRows((prev) => {
      const from = prev.findIndex((r) => r.key === active.id);
      const to = prev.findIndex((r) => r.key === over.id);
      return arrayMove(prev, from, to);
    });
  }

  function handleSave() {
    setError(null);
    if (!name.trim()) {
      setError("Give the template a name.");
      return;
    }
    if (rows.length === 0) {
      setError("Add at least one exercise.");
      return;
    }
    const exercisesPayload: {
      exerciseId: string;
      sets: number;
      notes: string;
      weightsKg: (number | null)[];
    }[] = [];
    for (const row of rows) {
      const sets = parseInt(row.sets, 10);
      if (!Number.isInteger(sets) || sets < 1 || sets > 20) {
        setError("Sets must be a whole number between 1 and 20.");
        return;
      }
      const weightsKg: (number | null)[] = [];
      for (const w of resizeWeights(row.weights, sets)) {
        if (w.trim() === "") {
          weightsKg.push(null);
          continue;
        }
        const value = parseFloat(w);
        if (!Number.isFinite(value) || value < 0) {
          setError("Suggested weights must be 0 or more (or left blank).");
          return;
        }
        weightsKg.push(unitToKg(value, unit));
      }
      exercisesPayload.push({
        exerciseId: row.exerciseId,
        sets,
        notes: row.notes,
        weightsKg,
      });
    }
    startSaving(async () => {
      const result = await saveTemplate({
        id: initial?.id,
        name,
        exercises: exercisesPayload,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push("/templates");
      router.refresh();
    });
  }

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Name
        <input
          type="text"
          placeholder="e.g. Push Day"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
      </label>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">
          Exercises{" "}
          <span className="font-normal text-zinc-500 dark:text-zinc-400">
            (drag ≡ to reorder)
          </span>
        </p>
        {rows.length > 0 && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={rows.map((r) => r.key)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="flex flex-col gap-2">
                {rows.map((row, index) => (
                  <SortableRow
                    key={row.key}
                    row={row}
                    name={nameOf.get(row.exerciseId) ?? "Unknown"}
                    unit={unit}
                    onChange={(patch) =>
                      setRows((prev) =>
                        prev.map((r, i) => (i === index ? { ...r, ...patch } : r)),
                      )
                    }
                    onRemove={() =>
                      setRows((prev) => prev.filter((_, i) => i !== index))
                    }
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}

        <select
          value=""
          onChange={(e) => {
            if (e.target.value === NEW_EXERCISE) setShowNew(true);
            else if (e.target.value) addRow(e.target.value);
          }}
          aria-label="Add exercise"
          className={inputClass}
        >
          <option value="">+ Add exercise…</option>
          {exercises.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.name}
            </option>
          ))}
          <option value={NEW_EXERCISE}>+ New exercise…</option>
        </select>

        {showNew && (
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              placeholder="e.g. Face Pull"
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                if (!newGroupTouched) setNewGroup(guessMuscleGroup(e.target.value));
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  confirmNewExercise();
                }
              }}
              className={`${inputClass} min-w-40 flex-1`}
              autoFocus
            />
            <select
              value={newGroup}
              onChange={(e) => {
                setNewGroup(e.target.value as MuscleGroup);
                setNewGroupTouched(true);
              }}
              aria-label="Muscle group"
              className={inputClass}
            >
              {MUSCLE_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {MUSCLE_GROUP_LABELS[g]}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={confirmNewExercise}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Create
            </button>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {saving ? "Saving…" : "Save template"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/templates")}
          className="rounded-md border border-zinc-300 px-4 py-2.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
