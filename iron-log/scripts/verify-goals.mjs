// Deterministic fixture check for lib/goals.ts — no Supabase, no network.
// Run with: node --experimental-strip-types scripts/verify-goals.mjs
import {
  computeGoalProgress,
  currentBucket,
  goalLabel,
  goalValueLabel,
  newlyCompletedGoals,
} from "../src/lib/goals.ts";
import { unitToKg } from "../src/lib/units.ts";

let pass = 0, fail = 0;
function check(label, ok) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (ok) pass++;
  else fail++;
}

const today = "2026-07-14"; // Tuesday; week bucket = Mon 2026-07-13
check("weekly bucket is Monday", currentBucket(today, "weekly") === "2026-07-13");
check("monthly bucket", currentBucket(today, "monthly") === "2026-07");

const inputs = {
  today,
  // two days this week (13th twice = one day), one last week, one last month
  workoutDates: ["2026-07-13", "2026-07-13", "2026-07-14", "2026-07-10", "2026-06-20"],
  setRows: [
    { date: "2026-07-13", weightKg: 100, reps: 5 }, // this week: 500
    { date: "2026-07-14", weightKg: 50, reps: 10 }, // this week: 500
    { date: "2026-07-06", weightKg: 200, reps: 5 }, // last week (this month): 1000
  ],
  cardioRows: [
    { date: "2026-07-13", durationSeconds: 1800 }, // 30 min this week
    { date: "2026-07-01", durationSeconds: 1200 }, // 20 min this month, not this week
  ],
  exerciseBestKg: { bench: 102.06 }, // ~225 lb
};

// sessions weekly: 2 distinct days this week vs target 4
const sessions = computeGoalProgress(
  { id: "1", metric: "sessions", period: "weekly", target: 4, exerciseId: null },
  inputs,
);
check("sessions weekly current=2", sessions.current === 2);
check("sessions weekly pct=0.5", sessions.pct === 0.5);
check("sessions weekly not achieved", !sessions.achieved);

// sessions monthly: 3 distinct July days (13, 14, 10)
const sessionsM = computeGoalProgress(
  { id: "1b", metric: "sessions", period: "monthly", target: 3, exerciseId: null },
  inputs,
);
check("sessions monthly current=3 achieved", sessionsM.current === 3 && sessionsM.achieved);

// volume weekly: 1000 kg vs 2000 target
const vol = computeGoalProgress(
  { id: "2", metric: "volume", period: "weekly", target: 2000, exerciseId: null },
  inputs,
);
check("volume weekly current=1000", vol.current === 1000);

// volume monthly: 2000 kg vs 2000 target -> achieved
const volM = computeGoalProgress(
  { id: "2b", metric: "volume", period: "monthly", target: 2000, exerciseId: null },
  inputs,
);
check("volume monthly achieved at exactly target", volM.achieved && volM.pct === 1);

// cardio weekly: 30 min vs 90
const cardio = computeGoalProgress(
  { id: "3", metric: "cardio_minutes", period: "weekly", target: 90, exerciseId: null },
  inputs,
);
check("cardio weekly current=30", cardio.current === 30);

// cardio monthly: 50 min
const cardioM = computeGoalProgress(
  { id: "3b", metric: "cardio_minutes", period: "monthly", target: 90, exerciseId: null },
  inputs,
);
check("cardio monthly current=50", cardioM.current === 50);

// exercise weight: best 102.06 vs target 100 kg -> achieved; vs 110 -> not
const exHit = computeGoalProgress(
  { id: "4", metric: "exercise_weight", period: null, target: 100, exerciseId: "bench" },
  inputs,
);
check("exercise_weight achieved", exHit.achieved);
const exMiss = computeGoalProgress(
  { id: "5", metric: "exercise_weight", period: null, target: 110, exerciseId: "bench" },
  inputs,
);
check("exercise_weight not achieved, pct<1", !exMiss.achieved && exMiss.pct < 1);
const exUnknown = computeGoalProgress(
  { id: "6", metric: "exercise_weight", period: null, target: 110, exerciseId: "nope" },
  inputs,
);
check("unknown exercise -> current 0", exUnknown.current === 0);

// labels
check(
  "sessions label",
  goalLabel({ id: "x", metric: "sessions", period: "weekly", target: 4, exerciseId: null }, null, "lb") ===
    "4 sessions / week",
);
check(
  "exercise label converts kg->lb",
  goalLabel(
    { id: "x", metric: "exercise_weight", period: null, target: unitToKg(225, "lb"), exerciseId: "bench" },
    "Bench Press",
    "lb",
  ) === "Bench Press · 225 lb",
);
check(
  "cardio value label",
  goalValueLabel({ id: "x", metric: "cardio_minutes", period: "weekly", target: 90, exerciseId: null }, 30, "lb") ===
    "30 min",
);

// newlyCompletedGoals: simulate saving a workout today (2026-07-14) that adds
// one session, 600 kg volume, and a 105 kg bench set.
const before = {
  today,
  workoutDates: ["2026-07-13"],
  setRows: [{ date: "2026-07-13", weightKg: 100, reps: 5 }], // 500 kg this week
  cardioRows: [],
  exerciseBestKg: { bench: 100 },
};
const after = {
  today,
  workoutDates: ["2026-07-13", "2026-07-14"],
  setRows: [
    { date: "2026-07-13", weightKg: 100, reps: 5 },
    { date: "2026-07-14", weightKg: 105, reps: 5 }, // +525 -> 1025 this week
  ],
  cardioRows: [],
  exerciseBestKg: { bench: 105 },
};
const candidates = [
  { id: "s2", metric: "sessions", period: "weekly", target: 2, exerciseId: null }, // 1 -> 2: crosses
  { id: "v1000", metric: "volume", period: "weekly", target: 1000, exerciseId: null }, // 500 -> 1025: crosses
  { id: "w105", metric: "exercise_weight", period: null, target: 105, exerciseId: "bench" }, // 100 -> 105: crosses
  { id: "s1", metric: "sessions", period: "weekly", target: 1, exerciseId: null }, // already achieved: no re-fire
  { id: "v9999", metric: "volume", period: "weekly", target: 9999, exerciseId: null }, // still unachieved
];
const completed = newlyCompletedGoals(candidates, before, after).map((g) => g.id);
check("sessions crossing detected", completed.includes("s2"));
check("volume crossing detected", completed.includes("v1000"));
check("exercise-weight crossing detected", completed.includes("w105"));
check("already-achieved goal does not re-fire", !completed.includes("s1"));
check("still-unachieved goal not included", !completed.includes("v9999"));
check("exactly 3 completions", completed.length === 3);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
