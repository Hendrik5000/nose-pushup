const INVITE_CODE_LENGTH = 32;
const MAX_INVITE_CODE_INPUT_LENGTH = 128;
const INVITE_CODE_PATTERN = /^[0-9A-F]{32}$/;

const JOIN_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  RATE_LIMITED:
    "Du kannst höchstens 8-mal pro Minute versuchen. Bitte warte eine Minute und versuche es erneut.",
  UNAUTHORIZED: "Du bist nicht berechtigt, diesem Battle oder Club beizutreten.",
  INVALID_CODE_FORMAT:
    "Der Einladungscode hat ein ungültiges Format. Prüfe den Code und versuche es erneut.",
  NOT_FOUND: "Der Einladungscode wurde nicht gefunden oder ist nicht mehr gültig.",
  BATTLE_NOT_FOUND: "Der Einladungscode wurde nicht gefunden oder ist nicht mehr gültig.",
  CLUB_NOT_FOUND: "Der Einladungscode wurde nicht gefunden oder ist nicht mehr gültig.",
  CLUB_FULL: "Der Club ist voll und kann keine weiteren Mitglieder aufnehmen.",
};

const UNKNOWN_JOIN_ERROR_MESSAGE =
  "Der Beitritt ist fehlgeschlagen. Bitte prüfe den Einladungscode und versuche es erneut.";

/** Create a 128-bit invitation code using only the platform's secure RNG. */
export function generateInviteCode(): string {
  const secureCrypto = globalThis.crypto;
  if (!secureCrypto || typeof secureCrypto.getRandomValues !== "function") {
    throw new Error("Sichere Zufallszahlen sind nicht verfügbar.");
  }

  const bytes = new Uint8Array(INVITE_CODE_LENGTH / 2);
  secureCrypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

/** Normalize user-entered codes without coercing values or accepting huge input. */
export function normalizeInviteCode(value: unknown): string {
  if (typeof value !== "string" || value.length > MAX_INVITE_CODE_INPUT_LENGTH) {
    return "";
  }

  return value.replace(/[\s-]/g, "").toUpperCase();
}

/** Validate only the canonical, ungrouped uppercase hexadecimal representation. */
export function isValidInviteCode(value: string): boolean {
  return typeof value === "string" && INVITE_CODE_PATTERN.test(value);
}

function collectErrorCodes(error: unknown): string[] {
  if (typeof error === "string") return [error.trim().toUpperCase()];
  if ((typeof error !== "object" || error === null) && typeof error !== "function") {
    return [];
  }

  const candidates: string[] = [];
  for (const key of ["code", "message", "error"]) {
    try {
      const candidate = (error as Record<string, unknown>)[key];
      if (typeof candidate === "string") candidates.push(candidate.trim().toUpperCase());
    } catch {
      // Ignore inaccessible properties; never surface arbitrary error details.
    }
  }
  return candidates;
}

/** Return a safe, allowlisted German message for invitation-join errors. */
export function getInviteJoinErrorMessage(error: unknown): string {
  for (const code of collectErrorCodes(error)) {
    const message = JOIN_ERROR_MESSAGES[code];
    if (message) return message;
  }

  return UNKNOWN_JOIN_ERROR_MESSAGE;
}
