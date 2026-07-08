// PR detection rules, shared by the live logger highlight (client) and
// saveWorkout (server, authoritative). Two PR kinds, per the project's
// resolved definition:
//   - weight PR: heavier than every historical set of the exercise
//   - rep PR:    more reps than the historical best at that exact weight
// Weights are canonical kg from one shared lb→kg conversion, so exact key
// matching on toFixed(3) is stable.
// A replica of this logic lives in scripts/demo-data.mjs — keep in sync.

export type PrSet = { weightKg: number; reps: number };

export type ExerciseBests = {
  maxWeightKg: number; // 0 when the exercise has no history
  repsAtWeight: Record<string, number>; // key: weightKg.toFixed(3)
};

export const weightKey = (weightKg: number) => weightKg.toFixed(3);

/** Reduce historical sets into bests. */
export function collectBests(history: PrSet[]): ExerciseBests {
  const bests: ExerciseBests = { maxWeightKg: 0, repsAtWeight: {} };
  for (const s of history) {
    bests.maxWeightKg = Math.max(bests.maxWeightKg, s.weightKg);
    const key = weightKey(s.weightKg);
    bests.repsAtWeight[key] = Math.max(bests.repsAtWeight[key] ?? 0, s.reps);
  }
  return bests;
}

/**
 * Flag PR sets within one session against historical bests.
 * - One weight PR max: the session's heaviest set, if it beats history
 *   (first occurrence when duplicated).
 * - Rep PRs: only at weights lifted BEFORE this session — per such weight,
 *   the session's best reps if it beats the historical best there (first
 *   occurrence). A brand-new weight is never a rep PR; going heavier than
 *   ever is already the weight PR.
 */
export function computePrFlags(sets: PrSet[], bests: ExerciseBests): boolean[] {
  const flags = sets.map(() => false);
  if (sets.length === 0) return flags;

  const sessionMax = Math.max(...sets.map((s) => s.weightKg));
  if (sessionMax > bests.maxWeightKg) {
    flags[sets.findIndex((s) => s.weightKg === sessionMax)] = true;
  }

  // Group set indices by weight, keeping only historically-lifted weights.
  const byWeight = new Map<string, number[]>();
  sets.forEach((s, i) => {
    const key = weightKey(s.weightKg);
    if (!(key in bests.repsAtWeight)) return;
    const list = byWeight.get(key);
    if (list) list.push(i);
    else byWeight.set(key, [i]);
  });
  for (const [key, indices] of byWeight) {
    const bestReps = Math.max(...indices.map((i) => sets[i].reps));
    if (bestReps > bests.repsAtWeight[key]) {
      flags[indices.find((i) => sets[i].reps === bestReps)!] = true;
    }
  }

  return flags;
}
