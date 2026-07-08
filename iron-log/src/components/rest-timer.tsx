"use client";

import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  useSyncExternalStore,
  type Ref,
} from "react";

const PRESETS = [60, 90, 120, 180];
const STORAGE_KEY = "ironlog-rest-seconds";

// Tiny external store for the rest-duration preset so render reads it via
// useSyncExternalStore (localStorage isn't readable during render).
const listeners = new Set<() => void>();
const durationStore = {
  get(): number {
    if (typeof window === "undefined") return 90;
    const v = Number(window.localStorage.getItem(STORAGE_KEY));
    return PRESETS.includes(v) ? v : 90;
  },
  set(v: number) {
    window.localStorage.setItem(STORAGE_KEY, String(v));
    listeners.forEach((l) => l());
  },
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
};

function fmt(totalSeconds: number) {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
}

export type LogSessionBarHandle = {
  /** (Re)start the rest countdown — called when a set is checked off. */
  startRest: () => void;
};

/**
 * Sticky bar under the logger: elapsed workout clock + rest countdown.
 * Countdown is anchored to an end timestamp (not tick decrements) so it stays
 * correct through re-renders and background-tab throttling. Silent at zero.
 */
export function LogSessionBar({
  handleRef,
}: {
  handleRef: Ref<LogSessionBarHandle>;
}) {
  const duration = useSyncExternalStore(
    durationStore.subscribe,
    durationStore.get,
    () => 90,
  );
  const startedAtRef = useRef<number | null>(null);
  const endsAtRef = useRef<number | null>(null);
  // elapsed seconds; rest = remaining seconds (null = idle)
  const [view, setView] = useState<{ elapsed: number; rest: number | null }>({
    elapsed: 0,
    rest: null,
  });

  const readClocks = () => {
    const now = Date.now();
    return {
      elapsed: startedAtRef.current ? (now - startedAtRef.current) / 1000 : 0,
      rest:
        endsAtRef.current === null ? null : (endsAtRef.current - now) / 1000,
    };
  };

  useEffect(() => {
    startedAtRef.current = Date.now();
    const id = setInterval(() => setView(readClocks()), 500);
    return () => clearInterval(id);
  }, []);

  useImperativeHandle(handleRef, () => ({
    startRest() {
      endsAtRef.current = Date.now() + durationStore.get() * 1000;
      setView(readClocks());
    },
  }));

  const running = view.rest !== null && view.rest > 0;
  const finished = view.rest !== null && view.rest <= 0;
  const pct = running
    ? Math.min(100, Math.max(0, ((view.rest ?? 0) / duration) * 100))
    : 0;

  return (
    <div className="sticky bottom-0 -mx-6 border-t border-zinc-200 bg-white/95 px-6 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
      <div className="flex items-center gap-4">
        <div className="flex flex-col">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Workout
          </span>
          <span className="font-mono text-sm font-medium tabular-nums">
            {fmt(view.elapsed)}
          </span>
        </div>

        <div className="flex flex-col">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Rest</span>
          <span
            className={`font-mono text-sm font-medium tabular-nums ${
              finished ? "text-emerald-600 dark:text-emerald-400" : ""
            }`}
          >
            {running ? fmt(view.rest ?? 0) : finished ? "Rest over" : "—"}
          </span>
        </div>

        <div className="h-1 min-w-8 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
          <div
            className="h-full rounded-full transition-[width] duration-300"
            style={{ width: `${pct}%`, background: "var(--chart-1)" }}
          />
        </div>

        <select
          value={duration}
          onChange={(e) => durationStore.set(Number(e.target.value))}
          aria-label="Rest duration"
          className="rounded-md border border-zinc-300 bg-transparent px-2 py-1 text-xs outline-none dark:border-zinc-700 dark:bg-zinc-950"
        >
          {PRESETS.map((p) => (
            <option key={p} value={p}>
              {p}s
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => {
            if (endsAtRef.current !== null) {
              endsAtRef.current += 15000;
              setView(readClocks());
            }
          }}
          disabled={!running}
          className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          +15s
        </button>
        <button
          type="button"
          onClick={() => {
            endsAtRef.current = null;
            setView(readClocks());
          }}
          disabled={view.rest === null}
          className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
