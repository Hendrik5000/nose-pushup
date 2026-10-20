// Missing history is distinct from a measured zero.
export function workoutBest(
  exerciseId: string,
  personalBests: Record<string, number> | null | undefined,
  legacyBest: number | null | undefined,
  historyBest: number | null,
): number | null {
  const explicit = personalBests?.[exerciseId];
  if (typeof explicit === "number" && Number.isFinite(explicit)) return explicit;
  if (exerciseId === "pushup" && typeof legacyBest === "number" && legacyBest > 0)
    return legacyBest;
  return historyBest;
}

export function adjustManualCount(value: string, delta: number): string {
  const parsed = value === "" ? 0 : parseManualCount(value);
  if (parsed === null) return value;
  return String(Math.max(0, Math.min(1000, parsed + delta)));
}

/** Parse only whole, non-negative manual counts within the UI's supported range. */
export function parseManualCount(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed <= 1000 ? parsed : null;
}

export function manualWorkoutInput(
  value: string,
  completedCount = 0,
): {
  count: number | null;
  error: string | null;
  canSubmit: boolean;
} {
  const count = parseManualCount(value);
  const remaining = Math.max(0, 1000 - completedCount);
  const error =
    value !== "" && count === null
      ? "Nur ganze Zahlen von 0 bis 1.000 eingeben."
      : count !== null && count > remaining
        ? `Pro Training sind insgesamt höchstens 1.000 Wiederholungen möglich. Für diesen Satz bleiben ${remaining}. Bitte korrigiere die Eingabe; dein Entwurf bleibt erhalten.`
        : null;
  return {
    count,
    error,
    canSubmit: count !== null && count > 0 && error === null,
  };
}

export function formatWorkoutCount(count: number, unit: "reps" | "seconds"): string {
  if (unit === "seconds") return `${count} ${count === 1 ? "Sekunde" : "Sekunden"}`;
  return `${count} ${count === 1 ? "Wiederholung" : "Wiederholungen"}`;
}

export function workoutCountUnit(unit: "reps" | "seconds"): string {
  return unit === "seconds" ? "Sek." : "Wdh.";
}
