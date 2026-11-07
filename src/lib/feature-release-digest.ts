import { isUuid } from "./friends/rpc";

export const FEATURE_RELEASE_KEY_PATTERN = /^[a-z0-9][a-z0-9._-]{2,63}$/;
export const FEATURE_RELEASE_TITLE_MAX = 72;
export const FEATURE_RELEASE_BODY_MAX = 320;

// Mirror the database guard's rejection of control characters in user-facing release text.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/u;
const BIDI_CONTROLS = /[\u202a-\u202e\u2066-\u2069]/u;
const UNSAFE_MARKUP_OR_URL = /[<>]|(javascript|vbscript|data)\s*:|https?:\/\//iu;

export function isSafeFeatureDigestText(value: unknown, maxChars: number): value is string {
  if (typeof value !== "string" || !Number.isInteger(maxChars) || maxChars < 1) return false;
  const trimmed = value.trim();
  const charCount = Array.from(trimmed).length;
  return (
    charCount > 0 &&
    charCount <= maxChars &&
    !CONTROL_CHARACTERS.test(value) &&
    !BIDI_CONTROLS.test(value) &&
    !UNSAFE_MARKUP_OR_URL.test(value)
  );
}

export type FeatureReleaseDigestRequest = Readonly<{
  releaseKey: string;
  title: string;
  body: string;
  confirmed: true;
}>;

export function parseFeatureReleaseDigestRequest(value: unknown): FeatureReleaseDigestRequest {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Ungültige Digest-Anfrage.");
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (
    keys.length !== 4 ||
    !["releaseKey", "title", "body", "confirmed"].every((key) => Object.hasOwn(record, key)) ||
    keys.some((key) => !["releaseKey", "title", "body", "confirmed"].includes(key)) ||
    record.confirmed !== true
  ) {
    throw new Error("Eine ausdrückliche Admin-Bestätigung ist erforderlich.");
  }
  if (
    typeof record.releaseKey !== "string" ||
    !FEATURE_RELEASE_KEY_PATTERN.test(record.releaseKey)
  ) {
    throw new Error("Ungültige Release-Kennung.");
  }
  if (!isSafeFeatureDigestText(record.title, FEATURE_RELEASE_TITLE_MAX)) {
    throw new Error("Der Digest-Titel ist ungültig.");
  }
  if (!isSafeFeatureDigestText(record.body, FEATURE_RELEASE_BODY_MAX)) {
    throw new Error("Der Digest-Text ist ungültig.");
  }
  return Object.freeze({
    releaseKey: record.releaseKey,
    title: record.title.trim(),
    body: record.body.trim(),
    confirmed: true,
  });
}

export type FeatureReleaseDigestResult = Readonly<{
  releaseId: string;
  wasCreated: boolean;
  recipientCount: number;
}>;

export function parseFeatureReleaseDigestResult(value: unknown): FeatureReleaseDigestResult {
  const rows = Array.isArray(value) ? value : [value];
  if (
    rows.length !== 1 ||
    typeof rows[0] !== "object" ||
    rows[0] === null ||
    Array.isArray(rows[0])
  ) {
    throw new Error("Digest-Ergebnis konnte nicht bestätigt werden.");
  }
  const row = rows[0] as Record<string, unknown>;
  const keys = Object.keys(row);
  if (
    keys.length !== 3 ||
    !["release_id", "was_created", "recipient_count"].every((key) => Object.hasOwn(row, key)) ||
    keys.some((key) => !["release_id", "was_created", "recipient_count"].includes(key)) ||
    !isUuid(row.release_id) ||
    typeof row.was_created !== "boolean" ||
    typeof row.recipient_count !== "number" ||
    !Number.isInteger(row.recipient_count) ||
    row.recipient_count < 0 ||
    (!row.was_created && row.recipient_count !== 0)
  ) {
    throw new Error("Digest-Ergebnis konnte nicht bestätigt werden.");
  }
  return Object.freeze({
    releaseId: row.release_id.toLowerCase(),
    wasCreated: row.was_created,
    recipientCount: row.recipient_count,
  });
}
