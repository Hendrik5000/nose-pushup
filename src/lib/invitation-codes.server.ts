import { randomBytes } from "node:crypto";

export const INVITATION_CODE_LENGTH = 16;
export const INVITATION_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Uses 5 cryptographically random bits per symbol (32-symbol alphabet). */
export function generateInvitationCode(): string {
  const bytes = randomBytes(INVITATION_CODE_LENGTH);
  let code = "";
  for (const byte of bytes) code += INVITATION_CODE_ALPHABET[byte & 31];
  return code;
}
