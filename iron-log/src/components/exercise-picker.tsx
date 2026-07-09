"use client";

import { useRouter } from "next/navigation";
import type { Exercise } from "@/lib/types";

export function ExercisePicker({
  exercises,
  selectedId,
}: {
  exercises: Exercise[];
  selectedId: string;
}) {
  const router = useRouter();
  return (
    <select
      value={selectedId}
      onChange={(e) =>
        router.push(`/trends?tab=exercise&exercise=${e.target.value}`)
      }
      aria-label="Exercise"
      className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-base outline-none focus:border-(--accent) sm:text-sm dark:border-zinc-700 dark:bg-zinc-950"
    >
      {exercises.map((ex) => (
        <option key={ex.id} value={ex.id}>
          {ex.name}
        </option>
      ))}
    </select>
  );
}
