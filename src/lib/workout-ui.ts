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
  return String(Math.max(0, Math.min(1000, (parseInt(value, 10) || 0) + delta)));
}
