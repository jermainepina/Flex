// Pure nutrition math — no Supabase or React imports (fixture-run standalone
// via `node --experimental-strip-types`, hence any relative imports use .ts
// extensions; currently self-contained). Deterministic — no AI, no APIs.
//
// The suggestion engine's activity factor comes from the user's REAL logged
// sessions/week, not a self-reported guess, and weight from their latest
// weigh-in. Height cm / weight kg canonical.

export type MacroKey = "calories" | "proteinG" | "carbsG" | "fatG" | "sugarG";

export const MACROS: {
  key: MacroKey;
  label: string;
  unit: string;
  /** "atLeast" fills toward the target; "under" is a cap (sugar). */
  direction: "atLeast" | "under";
}[] = [
  { key: "calories", label: "Calories", unit: "kcal", direction: "atLeast" },
  { key: "proteinG", label: "Protein", unit: "g", direction: "atLeast" },
  { key: "carbsG", label: "Carbs", unit: "g", direction: "atLeast" },
  { key: "fatG", label: "Fat", unit: "g", direction: "atLeast" },
  { key: "sugarG", label: "Sugar", unit: "g", direction: "under" },
];

export type NutritionTargets = Record<MacroKey, number>;

export type FoodEntry = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  sugarG: number;
};

export type NutritionObjective = "cut" | "bulk" | "maintain";

export type SuggestInputs = {
  weightKg: number;
  heightCm: number | null;
  birthYear: number | null;
  sex: "male" | "female" | null;
  /** Real training frequency from logged workouts (last ~4 weeks). */
  sessionsPerWeek: number;
  objective: NutritionObjective;
  /** Current year, injected for deterministic tests. */
  currentYear: number;
};

export type NutritionSuggestion = NutritionTargets & {
  method: "mifflin" | "heuristic";
};

const OBJECTIVE_FACTOR: Record<NutritionObjective, number> = {
  cut: 0.8,
  maintain: 1.0,
  bulk: 1.12,
};

/** Stepped activity multiplier from real sessions/week. */
function activityFactor(sessionsPerWeek: number): number {
  if (sessionsPerWeek < 1) return 1.2;
  if (sessionsPerWeek < 3) return 1.375;
  if (sessionsPerWeek < 5) return 1.55;
  return 1.725;
}

const roundTo = (n: number, step: number) => Math.round(n / step) * step;

/**
 * Suggested daily targets. Mifflin-St Jeor when height/age/sex are all
 * available; otherwise a weight-based heuristic (~22 kcal/kg maintenance
 * scaled by real training frequency). Never invents missing body data.
 */
export function suggestNutrition(inputs: SuggestInputs): NutritionSuggestion {
  const age =
    inputs.birthYear !== null ? inputs.currentYear - inputs.birthYear : null;
  const useMifflin =
    inputs.heightCm !== null &&
    inputs.sex !== null &&
    age !== null &&
    age >= 10 &&
    age <= 120;

  let maintenance: number;
  if (useMifflin) {
    const bmr =
      10 * inputs.weightKg +
      6.25 * (inputs.heightCm as number) -
      5 * (age as number) +
      (inputs.sex === "male" ? 5 : -161);
    maintenance = bmr * activityFactor(inputs.sessionsPerWeek);
  } else {
    maintenance =
      22 * inputs.weightKg * (1 + 0.033 * Math.min(7, inputs.sessionsPerWeek));
  }

  const calories = Math.max(1200, roundTo(maintenance * OBJECTIVE_FACTOR[inputs.objective], 50));
  const proteinG = roundTo(
    inputs.weightKg * (inputs.objective === "cut" ? 2.2 : 1.8),
    5,
  );
  const fatShare = inputs.objective === "cut" ? 0.3 : 0.25;
  const fatG = roundTo((calories * fatShare) / 9, 5);
  const carbsG = Math.max(
    0,
    roundTo((calories - proteinG * 4 - fatG * 9) / 4, 5),
  );
  const sugarG = roundTo((calories * 0.1) / 4, 5);

  return { calories, proteinG, carbsG, fatG, sugarG, method: useMifflin ? "mifflin" : "heuristic" };
}

/** Sum a day's food-log entries. */
export function dailyTotals(entries: FoodEntry[]): FoodEntry {
  const total: FoodEntry = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, sugarG: 0 };
  for (const e of entries) {
    total.calories += e.calories;
    total.proteinG += e.proteinG;
    total.carbsG += e.carbsG;
    total.fatG += e.fatG;
    total.sugarG += e.sugarG;
  }
  return total;
}

const CM_PER_INCH = 2.54;

/** cm -> { feet, inches } for display when the user's unit is lb. */
export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalInches = Math.round(cm / CM_PER_INCH);
  return { feet: Math.floor(totalInches / 12), inches: totalInches % 12 };
}

export function feetInchesToCm(feet: number, inches: number): number {
  return Math.round((feet * 12 + inches) * CM_PER_INCH * 10) / 10;
}
