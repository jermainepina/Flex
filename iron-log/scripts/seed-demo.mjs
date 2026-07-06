// Seeds the demo user with ~6 months of generated workouts. Reusable:
// re-running wipes the demo user's existing data and reseeds up to today.
//   npm run seed:demo
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
  DEMO_EMAIL,
  DEMO_PASSWORD,
  EXERCISE_GROUPS,
  generateDemoData,
} from "./demo-data.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(root, ".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } },
);

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  // Sign in, or create the account on first run.
  let auth = await supabase.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  });
  if (auth.error) {
    auth = await supabase.auth.signUp({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
    if (auth.error) throw new Error(`demo user auth failed: ${auth.error.message}`);
    if (!auth.data.session) {
      throw new Error(
        "Sign-up returned no session — is email confirmation enabled? Disable it or confirm the demo user manually.",
      );
    }
  }
  const userId = auth.data.user.id;

  // Wipe previous demo data (cascades take children).
  await supabase.from("workouts").delete().eq("user_id", userId);
  await supabase.from("exercises").delete().eq("user_id", userId);

  const anchor = new Date().toISOString().slice(0, 10);
  const data = generateDemoData(anchor);

  const { data: exRows, error: exErr } = await supabase
    .from("exercises")
    .insert(
      data.exercises.map((name) => ({
        user_id: userId,
        name,
        muscle_group: EXERCISE_GROUPS[name] ?? "other",
      })),
    )
    .select("id, name");
  if (exErr) throw new Error(`exercises: ${exErr.message}`);
  const exId = new Map(exRows.map((r) => [r.name, r.id]));

  let workoutCount = 0;
  let setCount = 0;
  for (const workoutBatch of chunk(data.workouts, 40)) {
    const { data: wRows, error: wErr } = await supabase
      .from("workouts")
      .insert(
        workoutBatch.map((w) => ({
          user_id: userId,
          date: `${w.date}T12:00:00Z`,
          type: w.type,
        })),
      )
      .select("id");
    if (wErr) throw new Error(`workouts: ${wErr.message}`);
    workoutCount += wRows.length;

    const weInput = workoutBatch.flatMap((w, wi) =>
      w.entries.map((entry, position) => ({
        workout_id: wRows[wi].id,
        exercise_id: exId.get(entry.exercise),
        notes: entry.notes,
        position,
      })),
    );
    if (weInput.length === 0) continue;
    const { data: weRows, error: weErr } = await supabase
      .from("workout_exercises")
      .insert(weInput)
      .select("id");
    if (weErr) throw new Error(`workout_exercises: ${weErr.message}`);

    const flatEntries = workoutBatch.flatMap((w) => w.entries);
    const setInput = flatEntries.flatMap((entry, ei) =>
      entry.sets.map((s, si) => ({
        workout_exercise_id: weRows[ei].id,
        set_number: si + 1,
        weight: s.weightKg,
        reps: s.reps,
      })),
    );
    for (const setBatch of chunk(setInput, 500)) {
      const { error: sErr } = await supabase.from("sets").insert(setBatch);
      if (sErr) throw new Error(`sets: ${sErr.message}`);
    }
    setCount += setInput.length;
  }

  console.log(`Seeded demo user with ${workoutCount} workouts / ${setCount} sets (anchor ${anchor}).`);
  console.log(`Sign in to browse:  ${DEMO_EMAIL}  /  ${DEMO_PASSWORD}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
