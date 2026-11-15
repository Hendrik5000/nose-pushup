/**
 * BMI-Berechnung mit lokal gespeicherter Körpergröße (Feature-Lauf 15.11.2026).
 * Die Größe bleibt gerätelokal (localStorage) und wird nicht in die Datenbank geschrieben.
 */

const HEIGHT_KEY = "alo-health-height-cm";

export function calculateBmi(weightKg: number, heightCm: number): number | null {
  if (!Number.isFinite(weightKg) || !Number.isFinite(heightCm)) return null;
  if (weightKg < 20 || weightKg > 400) return null;
  if (heightCm < 80 || heightCm > 250) return null;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

export type BmiCategory = { label: string; tone: "info" | "ok" | "warn" | "alert" };

export function bmiCategory(bmi: number): BmiCategory {
  if (bmi < 18.5) return { label: "Untergewicht", tone: "info" };
  if (bmi < 25) return { label: "Normalgewicht", tone: "ok" };
  if (bmi < 30) return { label: "Übergewicht", tone: "warn" };
  return { label: "Adipositas", tone: "alert" };
}

export function getStoredHeightCm(): number | null {
  try {
    const raw = window.localStorage.getItem(HEIGHT_KEY);
    if (raw == null) return null;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 80 || value > 250) return null;
    return value;
  } catch {
    return null;
  }
}

export function setStoredHeightCm(cm: number | null): boolean {
  try {
    if (cm == null) {
      window.localStorage.removeItem(HEIGHT_KEY);
      return true;
    }
    if (!Number.isFinite(cm) || cm < 80 || cm > 250) return false;
    window.localStorage.setItem(HEIGHT_KEY, String(cm));
    return true;
  } catch {
    return false;
  }
}
