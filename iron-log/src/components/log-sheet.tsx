"use client";

import { useRouter } from "next/navigation";
import { Apple, Dumbbell } from "lucide-react";

/**
 * Bottom sheet shown when Log is pressed: choose what to log. Slides up
 * (motion-safe), backdrop tap closes. Shared by both navs.
 */
export function LogSheet({ onClose }: { onClose: () => void }) {
  const router = useRouter();

  function go(href: string) {
    onClose();
    router.push(href);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="What do you want to log?"
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-2xl border border-b-0 border-zinc-200 bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] motion-safe:animate-[sheet-up_0.25s_ease-out_both] dark:border-zinc-800 dark:bg-zinc-950"
      >
        <p className="label-mono mb-3 text-center">Log</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => go("/log")}
            className="card flex flex-col items-center gap-2 p-5 transition-transform hover:scale-[1.02] active:scale-95"
          >
            <span
              aria-hidden
              className="flex h-12 w-12 items-center justify-center rounded-full"
              style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
            >
              <Dumbbell size={22} strokeWidth={2.5} />
            </span>
            <span className="text-sm font-semibold">Workout</span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Lifting or cardio
            </span>
          </button>
          <button
            type="button"
            onClick={() => go("/log/food")}
            className="card flex flex-col items-center gap-2 p-5 transition-transform hover:scale-[1.02] active:scale-95"
          >
            <span
              aria-hidden
              className="flex h-12 w-12 items-center justify-center rounded-full"
              style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
            >
              <Apple size={22} strokeWidth={2.5} />
            </span>
            <span className="text-sm font-semibold">Food</span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Meals & macros
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
