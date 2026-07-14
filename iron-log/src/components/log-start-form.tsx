"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { HeartPulse, Play, Timer } from "lucide-react";
import {
  CUSTOM_MAX,
  CUSTOM_MIN,
  durationStore,
  PRESETS,
} from "@/components/rest-timer";
import { CARDIO_KINDS } from "@/lib/types";

const CARDIO_PRESETS = [15, 20, 30, 45, 60]; // minutes
const CARDIO_MIN = 5;
const CARDIO_MAX = 600;

// Local date as YYYY-MM-DD (en-CA locale formats exactly that way).
function today() {
  return new Date().toLocaleDateString("en-CA");
}

// text-base on mobile so iOS doesn't auto-zoom focused inputs
const inputClass =
  "rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-base outline-none focus:border-(--accent) sm:text-sm dark:border-zinc-700";

/**
 * Pre-workout setup: template, date, name, and rest-timer preset (persisted to
 * the same store the in-session bar reads). START shows a lime launch overlay,
 * then navigates to /log/active with only the non-default params.
 */
export function LogStartForm({
  templates,
  initialTemplateId,
}: {
  templates: { id: string; name: string }[];
  initialTemplateId: string | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"lifting" | "cardio">("lifting");
  const [templateId, setTemplateId] = useState(initialTemplateId ?? "");
  const [date, setDate] = useState(today);
  const [name, setName] = useState("");
  const [cardioKind, setCardioKind] = useState<string>(CARDIO_KINDS[0]);
  const [cardioMinutes, setCardioMinutes] = useState(30);
  const [cardioCustomOpen, setCardioCustomOpen] = useState(false);
  const [cardioCustomValue, setCardioCustomValue] = useState("30");
  const [launching, setLaunching] = useState(false);
  const launchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restSeconds = useSyncExternalStore(
    durationStore.subscribe,
    durationStore.get,
    () => 90,
  );
  const isCustomActive = !PRESETS.includes(restSeconds);
  const [customOpen, setCustomOpen] = useState(false);
  const [customValue, setCustomValue] = useState(() => String(restSeconds));

  function applyCustom(raw: string) {
    const n = Math.round(Number(raw));
    if (Number.isFinite(n) && n >= CUSTOM_MIN && n <= CUSTOM_MAX) {
      durationStore.set(n);
      setCustomOpen(false);
    }
  }

  useEffect(() => {
    return () => {
      if (launchTimer.current) clearTimeout(launchTimer.current);
    };
  }, []);

  function applyCardioCustom(raw: string) {
    const n = Math.round(Number(raw));
    if (Number.isFinite(n) && n >= CARDIO_MIN && n <= CARDIO_MAX) {
      setCardioMinutes(n);
      setCardioCustomOpen(false);
    }
  }

  function start() {
    let url: string;
    if (mode === "cardio") {
      const params = new URLSearchParams();
      params.set("minutes", String(cardioMinutes));
      params.set("name", name.trim() || cardioKind);
      if (date && date !== today()) params.set("date", date);
      url = `/log/cardio?${params.toString()}`;
    } else {
      const params = new URLSearchParams();
      if (templateId) params.set("template", templateId);
      if (date && date !== today()) params.set("date", date);
      if (name.trim()) params.set("name", name.trim());
      const query = params.toString();
      url = query ? `/log/active?${query}` : "/log/active";
    }

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion) {
      router.push(url);
      return;
    }
    setLaunching(true);
    launchTimer.current = setTimeout(() => router.push(url), 850);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-1 self-start rounded-lg border border-zinc-200 p-1 dark:border-zinc-800">
        {(["lifting", "cardio"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            className={`flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-semibold ${
              mode === m
                ? "bg-(--accent) text-(--accent-ink)"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            {m === "lifting" ? (
              <Play size={14} aria-hidden />
            ) : (
              <HeartPulse size={14} aria-hidden />
            )}
            {m === "lifting" ? "Lifting" : "Cardio"}
          </button>
        ))}
      </div>

      <section className="card flex flex-col gap-3 p-4">
        <p className="label-mono">Session setup</p>
        {mode === "lifting" ? (
          <label className="flex flex-col gap-1 text-sm font-medium">
            Template
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className={`${inputClass} bg-white dark:bg-zinc-950`}
            >
              <option value="">None (blank workout)</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="flex flex-col gap-1 text-sm font-medium">
            Cardio type
            <select
              value={cardioKind}
              onChange={(e) => setCardioKind(e.target.value)}
              className={`${inputClass} bg-white dark:bg-zinc-950`}
            >
              {CARDIO_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
        )}
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
            {mode === "lifting" ? "Workout name" : "Session name"}
            <input
              type="text"
              placeholder={
                mode === "lifting"
                  ? "e.g. Push Day (optional)"
                  : `${cardioKind} (optional)`
              }
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>
      </section>

      {mode === "cardio" && (
        <section className="card flex flex-col gap-3 p-4">
          <p className="label-mono flex items-center gap-1.5">
            <Timer size={14} aria-hidden />
            Session length
          </p>
          <div className="flex flex-wrap gap-2">
            {CARDIO_PRESETS.map((m) => {
              const active = m === cardioMinutes && !cardioCustomOpen;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setCardioCustomOpen(false);
                    setCardioMinutes(m);
                  }}
                  aria-pressed={active}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                    active
                      ? "border-transparent"
                      : "border-zinc-300 text-zinc-600 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-100"
                  }`}
                  style={
                    active
                      ? { background: "var(--accent)", color: "var(--accent-ink)" }
                      : undefined
                  }
                >
                  {m} min
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => {
                setCardioCustomValue(String(cardioMinutes));
                setCardioCustomOpen(true);
              }}
              aria-pressed={
                (!CARDIO_PRESETS.includes(cardioMinutes) || cardioCustomOpen)
              }
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                !CARDIO_PRESETS.includes(cardioMinutes) || cardioCustomOpen
                  ? "border-transparent"
                  : "border-zinc-300 text-zinc-600 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
              style={
                !CARDIO_PRESETS.includes(cardioMinutes) || cardioCustomOpen
                  ? { background: "var(--accent)", color: "var(--accent-ink)" }
                  : undefined
              }
            >
              {!CARDIO_PRESETS.includes(cardioMinutes) && !cardioCustomOpen
                ? `Custom (${cardioMinutes} min)`
                : "Custom"}
            </button>
          </div>
          {cardioCustomOpen && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="number"
                min={CARDIO_MIN}
                max={CARDIO_MAX}
                inputMode="numeric"
                value={cardioCustomValue}
                onChange={(e) => setCardioCustomValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyCardioCustom(cardioCustomValue);
                  }
                }}
                className={`${inputClass} w-24`}
                aria-label="Custom session length in minutes"
                autoFocus
              />
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                minutes
              </span>
              <button
                type="button"
                onClick={() => applyCardioCustom(cardioCustomValue)}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                Set
              </button>
            </div>
          )}
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            You can add or subtract time mid-session.
          </p>
        </section>
      )}

      {mode === "lifting" && (
      <section className="card flex flex-col gap-3 p-4">
        <p className="label-mono flex items-center gap-1.5">
          <Timer size={14} aria-hidden />
          Rest timer
        </p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => {
            const active = p === restSeconds && !customOpen;
            return (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setCustomOpen(false);
                  durationStore.set(p);
                }}
                aria-pressed={active}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                  active
                    ? "border-transparent"
                    : "border-zinc-300 text-zinc-600 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-100"
                }`}
                style={
                  active
                    ? { background: "var(--accent)", color: "var(--accent-ink)" }
                    : undefined
                }
              >
                {p}s
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => {
              setCustomValue(String(restSeconds));
              setCustomOpen(true);
            }}
            aria-pressed={isCustomActive || customOpen}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
              isCustomActive || customOpen
                ? "border-transparent"
                : "border-zinc-300 text-zinc-600 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
            style={
              isCustomActive || customOpen
                ? { background: "var(--accent)", color: "var(--accent-ink)" }
                : undefined
            }
          >
            {isCustomActive && !customOpen ? `Custom (${restSeconds}s)` : "Custom"}
          </button>
        </div>

        {customOpen && (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              min={CUSTOM_MIN}
              max={CUSTOM_MAX}
              inputMode="numeric"
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyCustom(customValue);
                }
              }}
              className={`${inputClass} w-24`}
              aria-label="Custom rest duration in seconds"
              autoFocus
            />
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              seconds
            </span>
            <button
              type="button"
              onClick={() => applyCustom(customValue)}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Set
            </button>
          </div>
        )}

        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Countdown between sets — you can still change it mid-workout.
        </p>
      </section>
      )}

      <button
        type="button"
        onClick={start}
        disabled={launching}
        className="btn-accent flex items-center justify-center gap-2 px-4 py-4 text-sm"
      >
        <Play size={16} aria-hidden />
        {mode === "lifting" ? "Start workout" : "Start cardio"}
      </button>

      {launching && (
        <div
          role="status"
          className="fixed inset-0 z-50 flex items-center justify-center motion-safe:animate-[go-overlay_0.45s_ease-out_both]"
          style={{ background: "var(--accent-ink)", color: "var(--accent)" }}
        >
          <span className="font-display text-5xl tracking-tight motion-safe:animate-[go-pop_0.5s_cubic-bezier(0.2,1.4,0.5,1)_0.15s_both] sm:text-6xl">
            LET&rsquo;S GO
          </span>
        </div>
      )}
    </div>
  );
}
