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

export function formatWorkoutCount(count: number, unit: "reps" | "seconds"): string {
  if (unit === "seconds") return `${count} ${count === 1 ? "Sekunde" : "Sekunden"}`;
  return `${count} ${count === 1 ? "Wiederholung" : "Wiederholungen"}`;
}

export function workoutCountUnit(unit: "reps" | "seconds"): string {
  return unit === "seconds" ? "Sek." : "Wdh.";
}
