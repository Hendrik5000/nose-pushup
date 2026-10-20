export type WorkoutContextGeneration = {
  key: string;
  generation: number;
};

export type PendingWorkoutSaveIdentity = {
  contextKey: string;
  draftKey: string;
  payloadKey: string;
  id: string;
  createdAt: string;
  durationMs: number;
};

/** Serialize route context deterministically, including every supplied search parameter. */
export function workoutContextKey(
  userId: string | null | undefined,
  exerciseId: string,
  search: Record<string, unknown>,
): string {
  const sortedSearch = Object.fromEntries(
    Object.entries(search).sort(([left], [right]) => left.localeCompare(right)),
  );
  return JSON.stringify([userId ?? null, exerciseId, sortedSearch]);
}

/** Increment on every context transition, including A -> B -> A within one route visit. */
export function nextWorkoutContextGeneration(
  previous: WorkoutContextGeneration,
  key: string,
): WorkoutContextGeneration {
  return key === previous.key ? previous : { key, generation: previous.generation + 1 };
}

export function workoutContextToken(visitId: number, context: WorkoutContextGeneration): string {
  return JSON.stringify([visitId, context.generation, context.key]);
}

/** Reuse an ID and timestamp only for the exact same context, draft and immutable payload. */
export function resolvePendingWorkoutSaveIdentity(
  contextKey: string,
  draftKey: string,
  payloadKey: string,
  existing: PendingWorkoutSaveIdentity | null,
  createId: () => string,
  createdAt: () => string,
  durationMs = 0,
): PendingWorkoutSaveIdentity {
  if (
    existing?.contextKey === contextKey &&
    existing.draftKey === draftKey &&
    existing.payloadKey === payloadKey
  ) {
    return existing;
  }
  return {
    contextKey,
    draftKey,
    payloadKey,
    id: createId(),
    createdAt: createdAt(),
    durationMs,
  };
}
