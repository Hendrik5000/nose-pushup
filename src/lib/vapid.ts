export const VAPID_KEY_CONFIGURATION_ERROR =
  "Push ist nicht konfiguriert: Der VAPID-Public-Key fehlt oder ist kein gültiger P-256-Schlüssel.";

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+={0,2}$/;

/** Decode and structurally validate the 65-byte uncompressed P-256 public key. */
export function decodeVapidPublicKey(publicKey: string): Uint8Array<ArrayBuffer> {
  const trimmed = publicKey.trim();
  if (!trimmed || !BASE64URL_PATTERN.test(trimmed)) {
    throw new Error(VAPID_KEY_CONFIGURATION_ERROR);
  }

  const unpadded = trimmed.replace(/=+$/, "");
  if (unpadded.length % 4 === 1) {
    throw new Error(VAPID_KEY_CONFIGURATION_ERROR);
  }

  const base64 = unpadded.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  let raw: string;
  try {
    raw = atob(padded);
  } catch {
    throw new Error(VAPID_KEY_CONFIGURATION_ERROR);
  }

  const key = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) {
    key[index] = raw.charCodeAt(index);
  }

  if (key.length !== 65 || key[0] !== 0x04) {
    throw new Error(VAPID_KEY_CONFIGURATION_ERROR);
  }
  return key;
}

/** Validate that the decoded uncompressed point is actually on the P-256 curve. */
export async function validateVapidPublicKey(publicKey: string): Promise<Uint8Array<ArrayBuffer>> {
  const key = decodeVapidPublicKey(publicKey);
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("Dieser Browser kann den VAPID-P-256-Schlüssel nicht prüfen.");
  }

  try {
    await subtle.importKey("raw", key, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  } catch {
    throw new Error(VAPID_KEY_CONFIGURATION_ERROR);
  }
  return key;
}

/** Cheap synchronous check used to show whether Push can be configured in the UI. */
export function isVapidPublicKeyConfigured(publicKey: string): boolean {
  try {
    decodeVapidPublicKey(publicKey);
    return true;
  } catch {
    return false;
  }
}
