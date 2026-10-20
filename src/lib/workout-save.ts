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

export type CapturedWorkoutDraft = {
  key: string;
  sessionSnapshot: string | null;
  rawAtCapture: string | null;
};

/** Survives route/component unmounts for this module lifetime; scoped cleanup is explicit. */
export const pendingWorkoutSaveCache = new Map<string, PendingWorkoutSaveIdentity>();

export function unplannedWorkoutDraftKey(
  visitId: number,
  revision: number,
  mode: "manual" | "activity",
  value: string | number | null,
): string {
  return JSON.stringify([mode, visitId, revision, value]);
}

export function workoutSaveIdentityLookupKey(
  contextKey: string,
  draftKey: string,
  payloadKey: string,
): string {
  return JSON.stringify([contextKey, draftKey, payloadKey]);
}

export function clearPendingWorkoutSaveContext(contextKey: string, draftKey?: string): void {
  for (const [key, identity] of pendingWorkoutSaveCache) {
    if (
      identity.contextKey === contextKey &&
      (draftKey === undefined || identity.draftKey === draftKey)
    ) {
      pendingWorkoutSaveCache.delete(key);
    }
  }
}

/** Capture the exact serialized session and storage value without trusting Storage accessors. */
export function captureWorkoutDraft(
  storage: Pick<Storage, "getItem">,
  key: string,
  session: unknown,
): CapturedWorkoutDraft | null {
  try {
    return {
      key,
      sessionSnapshot: session === null || session === undefined ? null : JSON.stringify(session),
      rawAtCapture: storage.getItem(key),
    };
  } catch {
    return null;
  }
}

/** Remove only the captured session if it is still byte-for-byte unchanged. */
export function removeCapturedWorkoutDraft(
  storage: Pick<Storage, "getItem" | "removeItem">,
  captured: CapturedWorkoutDraft | null,
): boolean {
  if (!captured?.sessionSnapshot || captured.rawAtCapture !== captured.sessionSnapshot)
    return false;
  try {
    if (storage.getItem(captured.key) !== captured.sessionSnapshot) return false;
    storage.removeItem(captured.key);
    return true;
  } catch {
    return false;
  }
}

/** True only if no draft existed at capture and storage is still empty. */
export function capturedDraftRemainsAbsent(
  storage: Pick<Storage, "getItem">,
  captured: CapturedWorkoutDraft | null,
): boolean {
  if (!captured || captured.rawAtCapture !== null) return false;
  try {
    return storage.getItem(captured.key) === null;
  } catch {
    return false;
  }
}

export type WorkoutSaveOutcome = "error" | "saved" | "queued";

export type WorkoutSaveFinalization = {
  draftRemoved: boolean;
  uiDraftClosed: boolean;
};

/** Errors are inert; confirmed saved/queued results finalize captured data even after navigation. */
export function finalizeWorkoutSave(options: {
  outcome: WorkoutSaveOutcome;
  storage: Pick<Storage, "getItem" | "removeItem"> | null;
  captured: CapturedWorkoutDraft | null;
  identityLookupKey: string;
  uiCurrent: boolean;
  onConfirmedSuccess?: () => void;
}): WorkoutSaveFinalization {
  if (options.outcome === "error") return { draftRemoved: false, uiDraftClosed: false };
  try {
    options.onConfirmedSuccess?.();
  } catch {
    // Optional metadata must not block an already-confirmed save from completing.
  }
  const draftRemoved = options.storage
    ? removeCapturedWorkoutDraft(options.storage, options.captured)
    : false;
  const uiDraftClosed =
    draftRemoved ||
    (options.uiCurrent &&
      options.storage !== null &&
      capturedDraftRemainsAbsent(options.storage, options.captured));
  if (options.uiCurrent && uiDraftClosed) pendingWorkoutSaveCache.delete(options.identityLookupKey);
  return { draftRemoved, uiDraftClosed };
}

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
