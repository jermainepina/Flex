"use client";

import { useState } from "react";

export type LiftCard = {
  id: string;
  name: string;
  // Pre-formatted server-side so unit logic stays in one place.
  best: string | null; // e.g. "372 lb"
  rateWk: string | null; // e.g. "+6 lb/wk"
  rateMo: string | null; // e.g. "≈ +26 lb/mo"
};

const VISIBLE_COLLAPSED = 3;

export function LiftProgressGrid({ cards }: { cards: LiftCard[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? cards : cards.slice(0, VISIBLE_COLLAPSED);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        {visible.map((lift) => (
          <div key={lift.id} className="card p-4">
            <p className="truncate text-sm font-medium">{lift.name}</p>
            {lift.best ? (
              <>
                <p className="font-display mt-2 text-2xl">
                  {lift.best}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  best est. 1RM this week
                </p>
                <p className="mt-2 text-sm font-medium">
                  {lift.rateWk}
                  <span className="ml-1 font-normal text-zinc-500 dark:text-zinc-400">
                    {lift.rateMo}
                  </span>
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                Not enough recent data.
              </p>
            )}
          </div>
        ))}
      </div>
      {cards.length > VISIBLE_COLLAPSED && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="self-start text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          {expanded
            ? "Show less ▴"
            : `View all ${cards.length} lifts ▾`}
        </button>
      )}
    </div>
  );
}
