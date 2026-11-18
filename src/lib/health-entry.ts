export type ExistingHealthMetrics = {
  steps: number | null;
  active_kcal: number | null;
  weight_kg: number | null;
  sleep_min: number | null;
};

export type HealthMetricsDraft = {
  steps: string;
  kcal: string;
  weight: string;
  sleepHours: string;
};

export type MergedHealthMetrics = {
  steps: number;
  active_kcal: number;
  weight_kg: number | null;
  sleep_min: number;
};

export class HealthEntryInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HealthEntryInputError";
  }
}

function readDraftNumber(raw: string, label: string, integer = false): number | null {
  if (!raw.trim()) return null;

  const value = Number(raw);
  if (!Number.isFinite(value) || (integer && !Number.isInteger(value))) {
    const expected = integer ? "eine ganze Zahl" : "eine gültige Zahl";
    throw new HealthEntryInputError(`${label}: Bitte ${expected} eingeben.`);
  }
  return value;
}

/** Blank fields preserve the stored metric; only explicitly entered values replace it. */
export function mergeHealthEntryMetrics(
  existing: ExistingHealthMetrics | null,
  draft: HealthMetricsDraft,
): MergedHealthMetrics {
  const steps = readDraftNumber(draft.steps, "Schritte", true);
  const kcal = readDraftNumber(draft.kcal, "Aktive Kalorien", true);
  const weight = readDraftNumber(draft.weight, "Gewicht");
  const sleepHours = readDraftNumber(draft.sleepHours, "Schlafdauer");

  return {
    steps: steps === null ? (existing?.steps ?? 0) : Math.max(0, Math.min(200_000, steps)),
    active_kcal: kcal === null ? (existing?.active_kcal ?? 0) : Math.max(0, Math.min(20_000, kcal)),
    weight_kg:
      weight === null ? (existing?.weight_kg ?? null) : Math.max(20, Math.min(400, weight)),
    sleep_min:
      sleepHours === null
        ? (existing?.sleep_min ?? 0)
        : Math.max(0, Math.min(1_440, Math.round(sleepHours * 60))),
  };
}
