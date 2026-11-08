export const CIRCUIT_OPTIONS = [
  { id: "pushup", label: "Liegestütze" },
  { id: "situp", label: "Sit-ups" },
  { id: "squat", label: "Kniebeugen" },
  { id: "plank", label: "Plank" },
  { id: "burpee", label: "Burpees" },
] as const;

export type CircuitExerciseId = (typeof CIRCUIT_OPTIONS)[number]["id"];
export type CircuitPlan = CircuitExerciseId[];

export function workoutCircuitStorageKey(userId: string) {
  return `np-workout-circuit-v1:${encodeURIComponent(userId)}`;
}

export function normalizeCircuit(value: unknown): CircuitPlan {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<string>(CIRCUIT_OPTIONS.map((exercise) => exercise.id));
  const result: CircuitExerciseId[] = [];
  for (const id of value) {
    if (typeof id === "string" && allowed.has(id) && !result.includes(id as CircuitExerciseId)) {
      result.push(id as CircuitExerciseId);
    }
    if (result.length === 4) break;
  }
  return result;
}

export function readWorkoutCircuit(userId: string): CircuitPlan {
  if (!userId || typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(workoutCircuitStorageKey(userId));
    return raw ? normalizeCircuit(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

export function saveWorkoutCircuit(userId: string, plan: unknown): boolean {
  if (!userId || typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(
      workoutCircuitStorageKey(userId),
      JSON.stringify(normalizeCircuit(plan)),
    );
    return true;
  } catch {
    return false;
  }
}

export function suggestNextRepTarget(
  currentTarget: number,
  minimum: number,
  maximum: number,
  rpe: number,
): number | null {
  if (![currentTarget, minimum, maximum, rpe].every(Number.isFinite)) return null;
  const low = Math.max(1, Math.min(100, Math.round(minimum)));
  const high = Math.max(1, Math.min(100, Math.round(maximum)));
  if (low > high) return null;
  const current = Math.max(low, Math.min(high, Math.round(currentTarget)));
  const effort = Math.max(1, Math.min(10, Math.round(rpe)));
  if (effort <= 6) return Math.min(high, current + 1);
  if (effort >= 9) return Math.max(low, current - 1);
  return current;
}

export function sideBalance(
  left: number,
  right: number,
): { difference: number; leading: "left" | "right" | "even" } {
  const safeLeft = Math.max(0, Math.floor(Number.isFinite(left) ? left : 0));
  const safeRight = Math.max(0, Math.floor(Number.isFinite(right) ? right : 0));
  if (safeLeft === safeRight) return { difference: 0, leading: "even" };
  return safeLeft > safeRight
    ? { difference: safeLeft - safeRight, leading: "left" }
    : { difference: safeRight - safeLeft, leading: "right" };
}

export function timeBudgetRemainingSeconds(
  budgetMinutes: number,
  startedAt: number,
  now = Date.now(),
) {
  if (!Number.isFinite(budgetMinutes) || budgetMinutes < 1 || !Number.isFinite(startedAt))
    return null;
  return Math.max(0, Math.ceil((startedAt + budgetMinutes * 60_000 - now) / 1000));
}
