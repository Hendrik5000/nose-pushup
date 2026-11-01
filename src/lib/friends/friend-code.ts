/**
 * Friend codes: 8 characters from an alphabet without I, L, O, 0 and 1, shown as XXXX-XXXX.
 * The server is authoritative; this module only normalises user input and formats codes.
 */
export const FRIEND_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const FRIEND_CODE_LENGTH = 8;

const FRIEND_CODE_PATTERN = /^[A-HJ-KM-NP-Z2-9]{8}$/;

/** Upper-case, drop spaces/dashes and map look-alike characters (O->0 is impossible, so I/L/O are rejected). */
export function normalizeFriendCode(input: string): string {
  return (typeof input === "string" ? input : "").replace(/[\s\-_.]/g, "").toUpperCase();
}

export function isValidFriendCode(input: string): boolean {
  return FRIEND_CODE_PATTERN.test(normalizeFriendCode(input));
}

/** "ABCD2345" -> "ABCD-2345". Invalid input is returned normalised but unformatted. */
export function formatFriendCode(input: string): string {
  const code = normalizeFriendCode(input);
  if (!FRIEND_CODE_PATTERN.test(code)) return code;
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/** Live formatting while typing: keeps at most 8 characters and inserts the dash after four. */
export function formatFriendCodeInput(input: string): string {
  const code = normalizeFriendCode(input).slice(0, FRIEND_CODE_LENGTH);
  return code.length > 4 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

export type FriendCodeProblem = "empty" | "too_short" | "too_long" | "bad_characters";

export function describeFriendCodeProblem(input: string): FriendCodeProblem | null {
  const code = normalizeFriendCode(input);
  if (code.length === 0) return "empty";
  if (code.length > FRIEND_CODE_LENGTH) return "too_long";
  if ([...code].some((char) => !FRIEND_CODE_ALPHABET.includes(char))) return "bad_characters";
  if (code.length < FRIEND_CODE_LENGTH) return "too_short";
  return null;
}

export const FRIEND_CODE_PROBLEM_TEXT: Record<FriendCodeProblem, string> = {
  empty: "Gib den Freundescode ein.",
  too_short: "Der Code hat 8 Zeichen, zum Beispiel K7QM-2XRT.",
  too_long: "Der Code hat nur 8 Zeichen.",
  bad_characters: "Der Code enthält nur Buchstaben und Ziffern, aber kein I, L, O, 0 und 1.",
};
