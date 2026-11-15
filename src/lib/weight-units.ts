/**
 * kg/lb-Einheiten-Umschalter für Gewichtswerte (Feature-Lauf 15.11.2026).
 * Rein clientseitig; Einstellung bleibt gerätelokal.
 */

export type WeightUnit = "kg" | "lb";

const UNIT_KEY = "alo-health-weight-unit";
const KG_PER_LB = 0.45359237;

export function kgToLb(kg: number): number {
  return kg / KG_PER_LB;
}

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB;
}

export function formatWeight(kg: number, unit: WeightUnit): string {
  if (!Number.isFinite(kg) || kg <= 0) return "—";
  return unit === "kg"
    ? `${kg.toFixed(1)} kg`
    : `${kgToLb(kg).toFixed(1)} lb`;
}

export function getPreferredWeightUnit(): WeightUnit {
  try {
    return window.localStorage.getItem(UNIT_KEY) === "lb" ? "lb" : "kg";
  } catch {
    return "kg";
  }
}

export function setPreferredWeightUnit(unit: WeightUnit): boolean {
  try {
    window.localStorage.setItem(UNIT_KEY, unit);
    return true;
  } catch {
    return false;
  }
}
