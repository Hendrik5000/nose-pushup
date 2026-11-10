import { getInviteJoinErrorMessage, isValidInviteCode } from "./invite-code";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UNAVAILABLE =
  "Der sichere Beitritt ist momentan nicht verfügbar. Bitte versuche es später erneut.";

function readSuccess(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(UNAVAILABLE);
  }
  const result = value as Record<string, unknown>;
  if (result.success !== true) throw new Error(getInviteJoinErrorMessage(result.error));
  return result;
}

function readId(value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) throw new Error(UNAVAILABLE);
  return value;
}

export function parseClubInviteResponse(value: unknown): { id: string } {
  const result = readSuccess(value);
  return { id: readId(result.club_id) };
}

export function parseBattleInviteResponse(value: unknown): {
  id: string;
  hostId: string;
  joined: boolean;
} {
  const result = readSuccess(value);
  if (typeof result.joined !== "boolean") throw new Error(UNAVAILABLE);
  return {
    id: readId(result.battle_id),
    hostId: readId(result.host_id),
    joined: result.joined,
  };
}

export function parsePublicMatchResponse(value: unknown): {
  id: string;
  code: string;
  matched: boolean;
} {
  const result = readSuccess(value);
  if (
    typeof result.code !== "string" ||
    !isValidInviteCode(result.code) ||
    typeof result.matched !== "boolean"
  ) {
    throw new Error(UNAVAILABLE);
  }
  return {
    id: readId(result.battle_id),
    code: result.code,
    matched: result.matched,
  };
}

export function parsePublicQueueLeaveResponse(value: unknown): {
  id: string;
  matched: boolean;
  cancelled: boolean;
} {
  const result = readSuccess(value);
  if (
    typeof result.matched !== "boolean" ||
    typeof result.cancelled !== "boolean" ||
    result.matched === result.cancelled
  ) {
    throw new Error(UNAVAILABLE);
  }
  return {
    id: readId(result.battle_id),
    matched: result.matched,
    cancelled: result.cancelled,
  };
}

/** A missing/new RPC must never reopen the old privileged join path. */
export function inviteRpcUnavailable(): Error {
  return new Error(UNAVAILABLE);
}
