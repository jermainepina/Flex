// Pure volume/trend aggregation — no Supabase or React imports so it stays
// unit-testable. Volume = tonnage: sum of weight × reps (kg internally).
// All date math uses the UTC date part, matching the noon-UTC storage
// convention for workouts.date.

import type { MuscleGroup } from "@/lib/types";

export type Granularity = "weekly" | "monthly" | "yearly";

export type VolumeRow = { date: string; weightKg: number; reps: number };
export type VolumeBucket = { bucket: string; label: string; totalKg: number };
export type SessionSetRow = {
  workoutId: string;
  date: string;
  weightKg: number;
  reps: number;
};
export type SessionBestPoint = { date: string; label: string; bestKg: number };
export type GroupVolumeRow = VolumeRow & { muscleGroup: MuscleGroup };
export type GroupVolumeBucket = {
  bucket: string;
  label: string;
  groupsKg: Record<MuscleGroup, number>;
};
export type ProgressionRate = { latestBestKg: number; ratePerWeekKg: number };

export const BUCKET_CAPS: Record<Granularity, number> = {
  weekly: 16,
  monthly: 12,
  yearly: 50,
};

const utcDay = (iso: string) => iso.slice(0, 10);

/** weekly → Monday of that week (YYYY-MM-DD), monthly → YYYY-MM, yearly → YYYY. */
export function bucketKey(iso: string, granularity: Granularity): string {
  const day = utcDay(iso);
  if (granularity === "yearly") return day.slice(0, 4);
  if (granularity === "monthly") return day.slice(0, 7);
  const d = new Date(`${day}T00:00:00Z`);
  const dow = d.getUTCDay(); // 0 = Sunday
  d.setUTCDate(d.getUTCDate() + (dow === 0 ? -6 : 1 - dow));
  return d.toISOString().slice(0, 10);
}

function nextBucket(bucket: string, granularity: Granularity): string {
  if (granularity === "yearly") return String(Number(bucket) + 1);
  if (granularity === "monthly") {
    const [y, m] = bucket.split("-").map(Number);
    return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
  }
  const d = new Date(`${bucket}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(0, 10);
}

export function bucketLabel(bucket: string, granularity: Granularity): string {
  if (granularity === "yearly") return bucket;
  if (granularity === "monthly") {
    const [y, m] = bucket.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    });
  }
  return new Date(`${bucket}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Bucket rows into totals, zero-filling empty buckets between the first and
 * last so the time axis doesn't hide gaps. Returns at most `cap` most-recent
 * buckets, sorted ascending.
 */
export function aggregateVolume(
  rows: VolumeRow[],
  granularity: Granularity,
  cap: number = BUCKET_CAPS[granularity],
): VolumeBucket[] {
  if (rows.length === 0) return [];
  const totals = new Map<string, number>();
  for (const r of rows) {
    const key = bucketKey(r.date, granularity);
    totals.set(key, (totals.get(key) ?? 0) + r.weightKg * r.reps);
  }
  const keys = [...totals.keys()].sort();
  const buckets: VolumeBucket[] = [];
  for (let k = keys[0]; k <= keys[keys.length - 1]; k = nextBucket(k, granularity)) {
    buckets.push({
      bucket: k,
      label: bucketLabel(k, granularity),
      totalKg: totals.get(k) ?? 0,
    });
  }
  return buckets.slice(-cap);
}

/** Epley estimated one-rep max. reps = 1 returns the weight itself. */
export function epley1Rm(weightKg: number, reps: number): number {
  return weightKg * (1 + reps / 30);
}

const metricValue = (row: SessionSetRow, metric: "weight" | "e1rm") =>
  metric === "weight" ? row.weightKg : epley1Rm(row.weightKg, row.reps);

/** Best set value (top-set weight or Epley e1RM) per workout, date ascending. */
export function sessionBestSeries(
  rows: SessionSetRow[],
  metric: "weight" | "e1rm",
): SessionBestPoint[] {
  const byWorkout = new Map<string, { date: string; bestKg: number }>();
  for (const r of rows) {
    const value = metricValue(r, metric);
    const cur = byWorkout.get(r.workoutId);
    if (!cur || value > cur.bestKg) {
      byWorkout.set(r.workoutId, { date: r.date, bestKg: value });
    }
  }
  return [...byWorkout.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((p) => ({
      date: p.date,
      label: new Date(p.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }),
      bestKg: p.bestKg,
    }));
}

/**
 * Rolling rate of progression for one exercise, smoothing session-to-session
 * noise: bucket best e1RM per calendar week, then rate = (latest weekly best −
 * earliest weekly best within the trailing `windowWeeks` calendar weeks) ÷
 * weeks between them. Needs ≥ 2 weekly points in the window.
 */
export function progressionRate(
  rows: SessionSetRow[],
  windowWeeks = 5,
): ProgressionRate | null {
  const weeklyBest = new Map<string, number>();
  for (const r of rows) {
    const wk = bucketKey(r.date, "weekly");
    const e1rm = epley1Rm(r.weightKg, r.reps);
    weeklyBest.set(wk, Math.max(weeklyBest.get(wk) ?? 0, e1rm));
  }
  const weeks = [...weeklyBest.keys()].sort();
  if (weeks.length === 0) return null;

  const latestWeek = weeks[weeks.length - 1];
  const cutoff = new Date(`${latestWeek}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - 7 * (windowWeeks - 1));
  const windowed = weeks.filter((w) => w >= cutoff.toISOString().slice(0, 10));
  if (windowed.length < 2) return null;

  const first = windowed[0];
  const last = windowed[windowed.length - 1];
  const weeksBetween =
    (new Date(`${last}T00:00:00Z`).getTime() -
      new Date(`${first}T00:00:00Z`).getTime()) /
    (7 * 24 * 3600 * 1000);
  return {
    latestBestKg: weeklyBest.get(last)!,
    ratePerWeekKg:
      (weeklyBest.get(last)! - weeklyBest.get(first)!) / weeksBetween,
  };
}

/**
 * Weekly tonnage per muscle group, zero-filled between first and last week,
 * capped to the most recent `cap` weeks.
 */
export function muscleGroupWeeklyVolume(
  rows: GroupVolumeRow[],
  groups: readonly MuscleGroup[],
  cap = 12,
): GroupVolumeBucket[] {
  if (rows.length === 0) return [];
  const totals = new Map<string, Record<MuscleGroup, number>>();
  const emptyGroups = () =>
    Object.fromEntries(groups.map((g) => [g, 0])) as Record<MuscleGroup, number>;
  for (const r of rows) {
    const key = bucketKey(r.date, "weekly");
    if (!totals.has(key)) totals.set(key, emptyGroups());
    totals.get(key)![r.muscleGroup] += r.weightKg * r.reps;
  }
  const keys = [...totals.keys()].sort();
  const buckets: GroupVolumeBucket[] = [];
  for (let k = keys[0]; k <= keys[keys.length - 1]; k = nextBucket(k, "weekly")) {
    buckets.push({
      bucket: k,
      label: bucketLabel(k, "weekly"),
      groupsKg: totals.get(k) ?? emptyGroups(),
    });
  }
  return buckets.slice(-cap);
}
