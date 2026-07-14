// Deterministic fixture check for lib/goals.ts — no Supabase, no network.
// Run with: node --experimental-strip-types scripts/verify-goals.mjs
import {
  computeGoalProgress,
  goalLabel,
  goalValueLabel,
  goalWindow,
  newlyCompletedGoals,
  suggestGoals,
} from "../src/lib/goals.ts";
import { unitToKg } from "../src/lib/units.ts";

let pass = 0, fail = 0;
function check(label, ok) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (ok) pass++;
  else fail++;
}

const g = (over) => ({
  id: "g",
  metric: "sessions",
  period: "weekly",
  target: 3,
  exerciseId: null,
  createdAt: "2026-07-08", // a Wednesday
  weekAnchor: "monday",
  ...over,
});

// --- goalWindow ---
const wMon = goalWindow(g({}));
check("monday weekly window starts on the Monday of creation week", wMon.start === "2026-07-06");
check("monday weekly window ends 7 days later", wMon.end === "2026-07-13");
const wRoll = goalWindow(g({ weekAnchor: "rolling" }));
check("rolling weekly window starts at creation", wRoll.start === "2026-07-08");
check("rolling weekly window ends creation+7", wRoll.end === "2026-07-15");
const wMonth = goalWindow(g({ period: "monthly" }));
check("monthly window = calendar month", wMonth.start === "2026-07-01" && wMonth.end === "2026-08-01");
check(
  "standing goal has no window",
  goalWindow(g({ metric: "exercise_weight", period: null, exerciseId: "bench" })) === null,
);

// --- window-scoped progress; rolling straddles a Monday ---
const inputs = {
  today: "2026-07-14",
  // Sat 11th and Mon 13th: the rolling window (8th-14th) sees both; the
  // monday-anchored window (6th-12th) sees only the 11th.
  workoutDates: ["2026-07-11", "2026-07-13", "2026-07-04"],
  setRows: [
    { date: "2026-07-11", weightKg: 100, reps: 5 }, // 500, in both windows
    { date: "2026-07-13", weightKg: 100, reps: 5 }, // 500, rolling only
    { date: "2026-07-04", weightKg: 999, reps: 9 }, // before both
  ],
  cardioRows: [
    { date: "2026-07-13", durationSeconds: 1800 }, // 30 min, rolling only
  ],
  exerciseBestKg: { bench: 102 },
};

const rollSessions = computeGoalProgress(g({ weekAnchor: "rolling", target: 2 }), inputs);
check("rolling sessions counts across the Monday boundary (2)", rollSessions.current === 2);
check("rolling sessions achieved", rollSessions.achieved);
const monSessions = computeGoalProgress(g({ target: 2 }), inputs);
check("monday sessions only counts its calendar week (1)", monSessions.current === 1);

const rollVol = computeGoalProgress(
  g({ metric: "volume", weekAnchor: "rolling", target: 1000 }),
  inputs,
);
check("rolling volume = 1000", rollVol.current === 1000 && rollVol.achieved);
const monVol = computeGoalProgress(g({ metric: "volume", target: 1000 }), inputs);
check("monday-week volume = 500", monVol.current === 500 && !monVol.achieved);

const rollCardio = computeGoalProgress(
  g({ metric: "cardio_minutes", weekAnchor: "rolling", target: 30 }),
  inputs,
);
check("rolling cardio 30 min achieved", rollCardio.achieved);

// --- expired / missed ---
check("monday weekly expired on the 14th (window ended 13th)", monSessions.expired);
check("unachieved+expired = missed", monSessions.missed);
check("rolling window (ends 15th) not expired on the 14th", !rollSessions.expired);
const expiredAchieved = computeGoalProgress(g({ target: 1 }), inputs);
check("achieved+expired is NOT missed", expiredAchieved.expired && !expiredAchieved.missed);
const standing = computeGoalProgress(
  g({ metric: "exercise_weight", period: null, exerciseId: "bench", target: 100 }),
  inputs,
);
check("standing goal never expires", !standing.expired && !standing.missed);
check("standing goal achieved from best-ever", standing.achieved);

// --- newlyCompletedGoals still detects fresh crossings ---
const before = { ...inputs, workoutDates: ["2026-07-11"], setRows: [inputs.setRows[0]], cardioRows: [] };
const crossed = newlyCompletedGoals(
  [g({ weekAnchor: "rolling", target: 2, id: "cross" }), g({ target: 1, id: "already" })],
  before,
  inputs,
);
check("fresh crossing detected", crossed.some((x) => x.id === "cross"));
check("already-achieved does not re-fire", !crossed.some((x) => x.id === "already"));

// --- labels ---
check(
  "rolling weekly label says / 7 days",
  goalLabel(g({ weekAnchor: "rolling", target: 4 }), null, "lb") === "4 sessions / 7 days",
);
check(
  "monday weekly label says / week",
  goalLabel(g({ target: 4 }), null, "lb") === "4 sessions / week",
);
check(
  "exercise label converts kg->lb",
  goalLabel(
    g({ metric: "exercise_weight", period: null, target: unitToKg(225, "lb"), exerciseId: "bench" }),
    "Bench Press",
    "lb",
  ) === "Bench Press · 225 lb",
);
check(
  "cardio value label",
  goalValueLabel(g({ metric: "cardio_minutes" }), 30, "lb") === "30 min",
);

// --- suggestGoals (unchanged rules) ---
const kg10klb = 10000 / 2.2046226218487757;
const bulk = suggestGoals(
  { frequency: "3-4", objective: "bulk", cardio: "none" },
  { avgWeeklyVolumeKg: kg10klb, unit: "lb" },
);
check("bulk: weekly sessions = 4", bulk.some((s) => s.metric === "sessions" && s.period === "weekly" && s.target === 4));
check("bulk: monthly sessions = 16", bulk.some((s) => s.metric === "sessions" && s.period === "monthly" && s.target === 16));
check(
  "bulk: volume = 11,500 lb rounded clean",
  Math.round(unitToKg(11500, "lb") * 100) ===
    Math.round(bulk.find((s) => s.metric === "volume").target * 100),
);
check("bulk + no cardio: no cardio goal", !bulk.some((s) => s.metric === "cardio_minutes"));
const cut = suggestGoals(
  { frequency: "5-6", objective: "cut", cardio: "light" },
  { avgWeeklyVolumeKg: kg10klb, unit: "lb" },
);
check("cut: cardio floor 90 min", cut.some((s) => s.metric === "cardio_minutes" && s.target === 90));
const noHistory = suggestGoals(
  { frequency: "2-3", objective: "maintain", cardio: "regular" },
  { avgWeeklyVolumeKg: null, unit: "kg" },
);
check("no history: volume suggestion skipped", !noHistory.some((s) => s.metric === "volume"));
check("regular cardio: 60 min", noHistory.some((s) => s.metric === "cardio_minutes" && s.target === 60));
const kgUser = suggestGoals(
  { frequency: "3-4", objective: "maintain", cardio: "none" },
  { avgWeeklyVolumeKg: 4100, unit: "kg" },
);
check("kg rounding to 250 step", kgUser.find((s) => s.metric === "volume").target % 250 === 0);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
