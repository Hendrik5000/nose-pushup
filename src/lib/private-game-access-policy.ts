import type { PrivateGameId } from "./private-game-policy";

export type PrivateGameAccessStatus = "checking" | "allowed" | "denied";

export type PrivateGameAccessState = {
  userId: string | null;
  status: PrivateGameAccessStatus;
  revision: number;
  requestId: number;
};

export type PrivateGameAccessEvent =
  | { type: "auth-change"; userId: string | null }
  | { type: "recheck"; userId: string }
  | { type: "check-start"; userId: string; revision: number; requestId: number }
  | {
      type: "check-result";
      userId: string;
      revision: number;
      requestId: number;
      allowed: boolean;
    };

export type PrivateGameDocumentLease = {
  userId: string;
  game: PrivateGameId;
  revision: number;
  document: string;
};

export function createPrivateGameAccessState(userId: string | null): PrivateGameAccessState {
  return {
    userId,
    status: userId ? "checking" : "denied",
    revision: 0,
    requestId: 0,
  };
}

export function reducePrivateGameAccess(
  state: PrivateGameAccessState,
  event: PrivateGameAccessEvent,
): PrivateGameAccessState {
  if (event.type === "auth-change") {
    return {
      userId: event.userId,
      status: event.userId ? "checking" : "denied",
      revision: state.revision + 1,
      requestId: state.requestId + 1,
    };
  }

  if (event.type === "recheck") {
    if (state.userId !== event.userId) return state;
    return {
      ...state,
      status: "checking",
      revision: state.revision + 1,
      requestId: state.requestId + 1,
    };
  }

  if (state.userId !== event.userId || state.revision !== event.revision) return state;

  if (event.type === "check-start") {
    if (event.requestId <= state.requestId) return state;
    return {
      ...state,
      requestId: event.requestId,
      status: state.status === "allowed" ? "allowed" : "checking",
    };
  }

  if (event.requestId !== state.requestId) return state;
  return { ...state, status: event.allowed ? "allowed" : "denied" };
}

export function hasPrivateGameAccessForUser(
  state: PrivateGameAccessState,
  userId: string | null,
): boolean {
  return Boolean(userId && state.userId === userId && state.status === "allowed");
}

export function getPrivateGameAccessStatusForUser(
  state: PrivateGameAccessState,
  userId: string | null,
): PrivateGameAccessStatus {
  if (!userId) return "denied";
  if (state.userId !== userId) return "checking";
  return state.status;
}

export function isCurrentPrivateGameDocument(
  lease: PrivateGameDocumentLease | null,
  currentUserId: string | null,
  currentGame: PrivateGameId | undefined,
  accessState: PrivateGameAccessState,
): lease is PrivateGameDocumentLease {
  return Boolean(
    lease &&
    currentUserId &&
    currentGame &&
    hasPrivateGameAccessForUser(accessState, currentUserId) &&
    lease.userId === currentUserId &&
    lease.game === currentGame &&
    lease.revision === accessState.revision,
  );
}
