export type WorkoutPhase = "preparation" | "active" | "rest" | "paused" | "completed";

export type WorkoutPlan = {
  sets: number;
  reps: number | null;
  restSeconds: number;
  title: string | null;
};

export type WorkoutSession = {
  version: 1;
  id: string;
  phase: WorkoutPhase;
  plan: WorkoutPlan;
  currentSet: number;
  currentReps: number;
  setReps: number[];
  startedAt: number | null;
  elapsedBeforePauseMs: number;
  restEndsAt: number | null;
  partial: boolean;
};

export type WorkoutSessionSummary = {
  plannedSets: number;
  actualSets: number;
  plannedReps: number | null;
  actualReps: number;
  plannedDurationMs: number | null;
  actualDurationMs: number;
  partial: boolean;
};

export type WorkoutSessionMetadata = {
  version: 1;
  rowId: string;
  userId: string;
  exerciseId: string;
  partial: boolean;
  summary: WorkoutSessionSummary;
  createdAt: string;
};

const clampInt = (value: unknown, min: number, max: number): number | undefined => {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : NaN;
  return Number.isInteger(n) && n >= min && n <= max ? n : undefined;
};

/** Accept only bounded whole-number plan values; malformed query fields are ignored. */
export function validateWorkoutSearch(search: Record<string, unknown>) {
  const mode =
    search.mode === "nose" || search.mode === "manual" || search.mode === "camera"
      ? search.mode
      : undefined;
  const sets = clampInt(search.sets, 1, 20);
  const invalidExplicitSets = search.sets !== undefined && sets === undefined;
  const rawReps = clampInt(search.reps, 1, 100);
  const reps =
    !invalidExplicitSets && rawReps !== undefined && rawReps * (sets ?? 1) <= 1000
      ? rawReps
      : undefined;
  const rest_s = clampInt(search.rest_s, 0, 600);
  const title = typeof search.title === "string" ? search.title.trim().slice(0, 80) : "";
  return {
    ...(mode ? { mode } : {}),
    ...(sets !== undefined ? { sets } : {}),
    ...(reps !== undefined ? { reps } : {}),
    ...(rest_s !== undefined ? { rest_s } : {}),
    ...(title ? { title } : {}),
  };
}

export function createWorkoutSession(
  plan: WorkoutPlan,
  now = Date.now(),
  id = globalThis.crypto?.randomUUID?.() ?? `session-${now}-${Math.random().toString(36).slice(2)}`,
): WorkoutSession {
  return {
    version: 1,
    id,
    phase: "preparation",
    plan: { ...plan },
    currentSet: 1,
    currentReps: 0,
    setReps: [],
    startedAt: null,
    elapsedBeforePauseMs: 0,
    restEndsAt: null,
    partial: false,
  };
}

export function recordWorkoutRep(session: WorkoutSession): WorkoutSession {
  if (session.phase !== "active") return session;
  return { ...session, currentReps: session.currentReps + 1 };
}

export function undoWorkoutRep(session: WorkoutSession): WorkoutSession {
  if (session.phase !== "active" || session.currentReps === 0) return session;
  return { ...session, currentReps: session.currentReps - 1 };
}

export function finishWorkoutSet(session: WorkoutSession, now = Date.now()): WorkoutSession {
  if (session.phase !== "active") return session;
  const setReps = [...session.setReps, session.currentReps];
  if (session.currentSet >= session.plan.sets) {
    return { ...session, phase: "completed", currentReps: 0, setReps, restEndsAt: null };
  }
  return {
    ...session,
    phase: "rest",
    currentReps: 0,
    setReps,
    currentSet: session.currentSet + 1,
    restEndsAt: now + session.plan.restSeconds * 1000,
  };
}

export function startWorkoutSet(session: WorkoutSession, now = Date.now()): WorkoutSession {
  if (session.phase !== "preparation" && session.phase !== "rest" && session.phase !== "paused")
    return session;
  return {
    ...session,
    phase: "active",
    startedAt: session.startedAt ?? now,
    restEndsAt: null,
  };
}

export function extendWorkoutRest(session: WorkoutSession, seconds = 30): WorkoutSession {
  if (session.phase !== "rest") return session;
  return {
    ...session,
    restEndsAt: (session.restEndsAt ?? Date.now()) + Math.max(1, Math.min(300, seconds)) * 1000,
  };
}

export function pauseWorkout(session: WorkoutSession, now = Date.now()): WorkoutSession {
  if (session.phase !== "active" && session.phase !== "rest" && session.phase !== "preparation")
    return session;
  const elapsedBeforePauseMs =
    session.elapsedBeforePauseMs + (session.startedAt ? Math.max(0, now - session.startedAt) : 0);
  return {
    ...session,
    phase: "paused",
    elapsedBeforePauseMs,
    startedAt: null,
    restEndsAt: null,
    partial: session.partial,
  };
}

export function discardWorkout(session: WorkoutSession): WorkoutSession {
  return {
    ...session,
    phase: "preparation",
    currentSet: 1,
    currentReps: 0,
    setReps: [],
    startedAt: null,
    elapsedBeforePauseMs: 0,
    restEndsAt: null,
    partial: false,
  };
}

export function summarizeWorkout(session: WorkoutSession, now = Date.now()): WorkoutSessionSummary {
  const actualReps = session.setReps.reduce((sum, reps) => sum + reps, 0) + session.currentReps;
  const actualSets = session.setReps.length + (session.currentReps > 0 ? 1 : 0);
  const actualDurationMs =
    session.elapsedBeforePauseMs + (session.startedAt ? Math.max(0, now - session.startedAt) : 0);
  const allSetsDone = session.phase === "completed";
  return {
    plannedSets: session.plan.sets,
    actualSets,
    plannedReps: session.plan.reps === null ? null : session.plan.sets * session.plan.reps,
    actualReps,
    plannedDurationMs: null,
    actualDurationMs,
    partial: session.partial || !allSetsDone,
  };
}

export function workoutSessionStorageKey(userId: string, exerciseId: string) {
  return `np-workout-session:${userId}:${exerciseId}`;
}

export function workoutMetadataStorageKey(userId: string, rowId: string) {
  return `np-workout-meta:${userId}:${rowId}`;
}

/** Local-only, row-UUID-linked details; no schema migration or gamification writes. */
export function writeWorkoutMetadata(
  storage: Pick<Storage, "setItem">,
  metadata: WorkoutSessionMetadata,
) {
  try {
    storage.setItem(
      workoutMetadataStorageKey(metadata.userId, metadata.rowId),
      JSON.stringify(metadata),
    );
    return true;
  } catch {
    return false;
  }
}

export function readWorkoutMetadata(
  storage: Pick<Storage, "getItem">,
  userId: string,
  rowId: string,
): WorkoutSessionMetadata | null {
  try {
    const value = JSON.parse(
      storage.getItem(workoutMetadataStorageKey(userId, rowId)) ?? "null",
    ) as WorkoutSessionMetadata | null;
    return value?.version === 1 && value.rowId === rowId && value.userId === userId ? value : null;
  } catch {
    return null;
  }
}

export function readWorkoutSession(
  storage: Pick<Storage, "getItem">,
  key: string,
): WorkoutSession | null {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw) as WorkoutSession;
    if (
      value.version !== 1 ||
      typeof value.id !== "string" ||
      !["preparation", "active", "rest", "paused", "completed"].includes(value.phase)
    )
      return null;
    if (
      !Array.isArray(value.setReps) ||
      !value.plan ||
      !Number.isInteger(value.currentSet) ||
      value.currentSet < 1
    )
      return null;
    return value;
  } catch {
    return null;
  }
}

export function writeWorkoutSession(
  storage: Pick<Storage, "setItem">,
  key: string,
  session: WorkoutSession,
) {
  try {
    storage.setItem(key, JSON.stringify(session));
    return true;
  } catch {
    return false;
  }
}
