"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { reorderGoals } from "@/app/(app)/goals/actions";
import { GoalCard } from "@/components/goal-card";
import type { Goal, GoalProgress } from "@/lib/goals";

export type GoalListItem = {
  goal: Goal;
  label: string;
  valueText: string;
  progress: GoalProgress;
};

function SortableGoal({ item }: { item: GoalListItem }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.goal.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "z-10 opacity-90" : ""}
    >
      <GoalCard
        goal={item.goal}
        label={item.label}
        valueText={item.valueText}
        progress={item.progress}
        handle={
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Reorder ${item.label}`}
            className="-ml-2 flex cursor-grab touch-none items-center self-stretch px-2 text-2xl text-zinc-400 hover:text-zinc-600 active:cursor-grabbing dark:hover:text-zinc-300"
          >
            ≡
          </button>
        }
      />
    </div>
  );
}

/**
 * Drag-to-rank goal list (importance order, top = most important — the
 * dashboard shows the top 3). Optimistic reorder, persisted via
 * reorderGoals; a failed persist refreshes back to the server order.
 */
export function GoalList({ items: initialItems }: { items: GoalListItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.goal.id === active.id);
    const to = items.findIndex((i) => i.goal.id === over.id);
    if (from === -1 || to === -1) return;
    const next = arrayMove(items, from, to);
    setItems(next);
    reorderGoals(next.map((i) => i.goal.id)).then((result) => {
      if (result.error) router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Drag ≡ to rank by importance — your top 3 show on the dashboard.
      </p>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map((i) => i.goal.id)}
          strategy={rectSortingStrategy}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map((item) => (
              <SortableGoal key={item.goal.id} item={item} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
