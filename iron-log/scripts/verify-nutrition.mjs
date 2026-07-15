// Deterministic fixture check for lib/nutrition.ts.
// Run with: node --experimental-strip-types scripts/verify-nutrition.mjs
import {
  cmToFeetInches,
  dailyTotals,
  feetInchesToCm,
  suggestNutrition,
} from "../src/lib/nutrition.ts";

let pass = 0, fail = 0;
function check(label, ok) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (ok) pass++;
  else fail++;
}

// Mifflin worked example: 80kg, 180cm, 30yo male, 3-4 sessions -> AF 1.55.
// BMR = 800 + 1125 - 150 + 5 = 1780; maintenance = 2759; maintain -> 2750.
const male = suggestNutrition({
  weightKg: 80,
  heightCm: 180,
  birthYear: 1996,
  sex: "male",
  sessionsPerWeek: 4,
  objective: "maintain",
  currentYear: 2026,
});
check("male mifflin method", male.method === "mifflin");
check("male maintain calories = 2750", male.calories === 2750);
check("male protein = 145 (80*1.8 rounded to 5)", male.proteinG === 145);
check("male sugar cap = 70 (10% cals / 4 -> 68.75 -> 70)", male.sugarG === 70);

// Female example: 60kg, 165cm, 25yo, 1-2 sessions -> AF 1.375.
// BMR = 600 + 1031.25 - 125 - 161 = 1345.25; maint 1849.7; cut x0.8 = 1479.8 -> 1500.
const female = suggestNutrition({
  weightKg: 60,
  heightCm: 165,
  birthYear: 2001,
  sex: "female",
  sessionsPerWeek: 2,
  objective: "cut",
  currentYear: 2026,
});
check("female mifflin method", female.method === "mifflin");
check("female cut calories = 1500", female.calories === 1500);
check("female cut protein = 130 (60*2.2=132 -> 130)", female.proteinG === 130);

// Heuristic fallback when height missing.
const fallback = suggestNutrition({
  weightKg: 80,
  heightCm: null,
  birthYear: 1996,
  sex: "male",
  sessionsPerWeek: 4,
  objective: "maintain",
  currentYear: 2026,
});
check("fallback method when height missing", fallback.method === "heuristic");
// 22*80 = 1760 * (1 + .132) = 1992.3 -> 2000
check("fallback maintain calories = 2000", fallback.calories === 2000);

// Macro calories re-sum to ~target (within 5% — rounding slack).
for (const s of [male, female, fallback]) {
  const resum = s.proteinG * 4 + s.carbsG * 4 + s.fatG * 9;
  check(
    `macros re-sum within 5% (${s.calories} vs ${resum})`,
    Math.abs(resum - s.calories) / s.calories < 0.05,
  );
}

// Monotonicity: bulk > maintain > cut calories; more sessions -> more cals.
const mk = (objective, sessions = 4) =>
  suggestNutrition({
    weightKg: 80, heightCm: 180, birthYear: 1996, sex: "male",
    sessionsPerWeek: sessions, objective, currentYear: 2026,
  }).calories;
check("bulk > maintain > cut", mk("bulk") > mk("maintain") && mk("maintain") > mk("cut"));
check("more sessions -> more calories", mk("maintain", 6) > mk("maintain", 0));

// Rounding steps.
check("calories step 50", male.calories % 50 === 0);
check("grams step 5", male.proteinG % 5 === 0 && male.fatG % 5 === 0 && male.carbsG % 5 === 0);

// dailyTotals
const total = dailyTotals([
  { calories: 500, proteinG: 40, carbsG: 50, fatG: 15, sugarG: 10 },
  { calories: 300.5, proteinG: 20, carbsG: 30, fatG: 10, sugarG: 5 },
]);
check("dailyTotals sums", total.calories === 800.5 && total.proteinG === 60 && total.sugarG === 15);

// Height conversion round-trips.
const fi = cmToFeetInches(180);
check("180cm = 5ft 11in", fi.feet === 5 && fi.inches === 11);
check("5ft11 -> ~180cm", Math.abs(feetInchesToCm(5, 11) - 180.3) < 0.2);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
