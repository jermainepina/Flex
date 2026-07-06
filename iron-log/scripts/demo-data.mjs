// Deterministic demo-workout generator (fixed-seed LCG, no Math.random) so the
// seeder and any verifier can independently produce the identical dataset for
// the same anchor date. 26 weeks of push/pull/legs (Mon/Wed/Fri) ending at the
// anchor, plus Saturday cardio every other week, a full skipped week for
// zero-fill testing, and progressive overload with a deload every 6th week.

const LB_PER_KG = 2.2046226218487757;
export const lbToKg = (lb) => lb / LB_PER_KG;

export const DEMO_EMAIL = "ironlog.demo@gmail.com";
export const DEMO_PASSWORD = "demo-IronLog-2026!";

export const WEEKS = 26;
export const SKIPPED_WEEK_INDEX = 20; // "vacation" — tests zero-filled buckets

// base/inc are in lb (rounded to 5 lb when applied), reps is the target.
const PLAN = {
  push: [
    { name: "Bench Press", base: 135, inc: 2.5, sets: 4, reps: 8 },
    { name: "Overhead Press", base: 85, inc: 1.25, sets: 3, reps: 8 },
    { name: "Incline Dumbbell Press", base: 50, inc: 1.25, sets: 3, reps: 10 },
  ],
  pull: [
    { name: "Deadlift", base: 225, inc: 5, sets: 3, reps: 5 },
    { name: "Barbell Row", base: 115, inc: 2.5, sets: 4, reps: 8 },
    { name: "Lat Pulldown", base: 100, inc: 2.5, sets: 3, reps: 10 },
  ],
  legs: [
    { name: "Squat", base: 185, inc: 5, sets: 4, reps: 6 },
    { name: "Leg Press", base: 270, inc: 5, sets: 3, reps: 10 },
    { name: "Leg Curl", base: 70, inc: 1.25, sets: 3, reps: 12 },
  ],
};

export const EXERCISE_NAMES = Object.values(PLAN).flatMap((list) =>
  list.map((e) => e.name),
);

function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const round5 = (lb) => Math.round(lb / 5) * 5;

function isoAddDays(iso, days) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Monday of the week containing the given YYYY-MM-DD. */
export function mondayOf(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  const dow = d.getUTCDay();
  return isoAddDays(iso, dow === 0 ? -6 : 1 - dow);
}

/**
 * Generate the dataset. `anchorDay` is a YYYY-MM-DD string; the last training
 * week is the week containing it. Returns:
 * { exercises: string[], workouts: [{ date, type, entries: [{ exercise, notes, sets: [{ weightKg, reps }] }] }] }
 */
export function generateDemoData(anchorDay) {
  const rand = lcg(0xf17e55);
  const lastMonday = mondayOf(anchorDay);
  const workouts = [];

  for (let week = 0; week < WEEKS; week++) {
    const monday = isoAddDays(lastMonday, -7 * (WEEKS - 1 - week));
    if (week === SKIPPED_WEEK_INDEX) {
      // burn the same number of rand() calls a normal week would consume is
      // unnecessary — determinism only requires identical call order, which
      // regenerating from scratch guarantees.
      continue;
    }
    const deload = (week + 1) % 6 === 0;

    const days = [
      { offset: 0, type: "push" },
      { offset: 2, type: "pull" },
      { offset: 4, type: "legs" },
    ];
    for (const { offset, type } of days) {
      // Occasionally life happens and a session is missed.
      if (rand() < 0.06) continue;
      const entries = PLAN[type].map((ex, position) => {
        let lb = round5(ex.base + ex.inc * week);
        if (deload) lb = round5(lb * 0.85);
        const sets = [];
        for (let s = 0; s < ex.sets; s++) {
          // Last set sometimes drops a rep or two.
          const drop = s === ex.sets - 1 && rand() < 0.4 ? (rand() < 0.5 ? 1 : 2) : 0;
          sets.push({ weightKg: lbToKg(lb), reps: Math.max(1, ex.reps - drop) });
        }
        return {
          exercise: ex.name,
          notes:
            position === 0 && deload
              ? "Deload week"
              : position === 0 && rand() < 0.15
                ? "Felt strong today"
                : null,
          sets,
        };
      });
      workouts.push({ date: isoAddDays(monday, offset), type, entries });
    }

    // Saturday cardio every other week — a workout with no strength entries.
    if (week % 2 === 0) {
      workouts.push({ date: isoAddDays(monday, 5), type: "cardio", entries: [] });
    }
  }

  return { exercises: EXERCISE_NAMES, workouts };
}
