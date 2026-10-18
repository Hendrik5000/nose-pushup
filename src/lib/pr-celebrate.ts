import { shouldCelebratePr } from "@/lib/extra-features";

/** Call after a workout save when a new personal best is detected. */
export function celebratePersonalBest(exerciseId: string, count: number): string | null {
  const key = `${exerciseId}:${count}`;
  if (!shouldCelebratePr(key)) return null;
  return `Neuer Bestwert: ${count} · ${exerciseId} 🏆`;
}
