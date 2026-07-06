// Pure volume/trend aggregation — no Supabase or React imports so it stays
// unit-testable. Volume = tonnage: sum of weight × reps (kg internally).
// All date math uses the UTC date part, matching the noon-UTC storage
// convention for workouts.date.

export type Granularity = "weekly" | "monthly" | "yearly";

export type VolumeRow = { date: string; weightKg: number; reps: number };
export type VolumeBucket = { bucket: string; label: string; totalKg: number };
export type TopSetRow = { workoutId: string; date: string; weightKg: number };
export type TopSetPoint = { date: string; label: string; maxKg: number };

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

/** Heaviest set per workout for one exercise, sorted by date ascending. */
export function topSetSeries(rows: TopSetRow[]): TopSetPoint[] {
  const byWorkout = new Map<string, { date: string; maxKg: number }>();
  for (const r of rows) {
    const cur = byWorkout.get(r.workoutId);
    if (!cur || r.weightKg > cur.maxKg) {
      byWorkout.set(r.workoutId, { date: r.date, maxKg: r.weightKg });
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
      maxKg: p.maxKg,
    }));
}
