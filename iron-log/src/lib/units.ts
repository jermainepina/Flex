// Weights are stored in kg in the database and converted to/from the user's
// preferred unit at the edge (entry and display). Keeping storage canonical
// means PR comparisons stay valid if the user switches units later.

export type WeightUnit = "lb" | "kg";

const LB_PER_KG = 2.2046226218487757;

export function kgToUnit(kg: number, unit: WeightUnit): number {
  return unit === "kg" ? kg : kg * LB_PER_KG;
}

export function unitToKg(value: number, unit: WeightUnit): number {
  return unit === "kg" ? value : value / LB_PER_KG;
}

/** Display a stored kg weight in the given unit, rounded to at most 1 decimal. */
export function formatWeight(kg: number, unit: WeightUnit): string {
  const value = Math.round(kgToUnit(kg, unit) * 10) / 10;
  return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)} ${unit}`;
}
