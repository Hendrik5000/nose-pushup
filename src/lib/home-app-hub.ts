import { scopedStorageKey } from "@/integrations/supabase/backendScope";

export const HOME_BACKGROUND_PRESETS = Object.freeze([
  { id: "aurora", label: "Polarlicht", src: "/home-backgrounds/aurora.svg" },
  { id: "dawn", label: "Morgenlicht", src: "/home-backgrounds/dawn.svg" },
  { id: "forest", label: "Wald", src: "/home-backgrounds/forest.svg" },
  { id: "ocean", label: "Ozean", src: "/home-backgrounds/ocean.svg" },
] as const);

export type HomeBackgroundPresetId = (typeof HOME_BACKGROUND_PRESETS)[number]["id"];
export type HomeBackgroundPreference =
  | Readonly<{ kind: "none" }>
  | Readonly<{ kind: "preset"; presetId: HomeBackgroundPresetId }>
  | Readonly<{ kind: "custom" }>;

export type HomeAppHubSettings = Readonly<{
  schemaVersion: 1;
  order: readonly string[];
  nameOverrides: Readonly<Record<string, string>>;
  background: HomeBackgroundPreference;
}>;

export type HomeAppHubStorage = Pick<Storage, "getItem" | "setItem">;

export const HOME_DEFAULT_BACKGROUND: HomeBackgroundPreference = Object.freeze({
  kind: "none",
});

export const EMPTY_HOME_APP_HUB_SETTINGS: HomeAppHubSettings = Object.freeze({
  schemaVersion: 1,
  order: Object.freeze([]),
  nameOverrides: Object.freeze({}),
  background: HOME_DEFAULT_BACKGROUND,
});

export const HOME_BACKGROUND_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const HOME_BACKGROUND_MAX_PIXELS = 24_000_000;
export const HOME_BACKGROUND_MAX_SOURCE_DIMENSION = 8_000;
export const HOME_BACKGROUND_MAX_OUTPUT_DIMENSION = 1_920;
export const HOME_BACKGROUND_MAX_OUTPUT_BYTES = 2 * 1024 * 1024;

const HOME_PRESET_IDS = new Set<string>(HOME_BACKGROUND_PRESETS.map(({ id }) => id));
const HOME_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const HOME_APP_ID_PATTERN = /^[a-z][a-z0-9-]{0,47}$/i;
const HOME_MARKETPLACE_APP_ID_PATTERN =
  /^marketplace:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HOME_NAME_MAX_CHARS = 48;
const HOME_MAX_APP_IDS = 128;
const HOME_MAX_NAME_OVERRIDES = 128;
const HOME_MAX_SETTINGS_BYTES = 32_768;
const HOME_BACKGROUND_DB_NAME = "alo-home-background-images-v1";
const HOME_BACKGROUND_DB_VERSION = 1;
const HOME_BACKGROUND_OBJECT_STORE = "images";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function validHomeAppId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    (HOME_APP_ID_PATTERN.test(value) || HOME_MARKETPLACE_APP_ID_PATTERN.test(value))
  );
}

function hasUnsafeHomeAppNameCharacter(value: string) {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return character === "<" || character === ">" || code <= 0x1f || (code >= 0x7f && code <= 0x9f);
  });
}

function normalizeHomeAppName(value: unknown): string {
  if (typeof value !== "string") throw new Error("App-Name muss Text sein.");
  const name = value.normalize("NFC").trim();
  if (!name || name.length > HOME_NAME_MAX_CHARS || hasUnsafeHomeAppNameCharacter(name)) {
    throw new Error("App-Name ist leer, zu lang oder enthält ungültige Steuerzeichen.");
  }
  return name;
}

function parseBackgroundPreference(value: unknown): HomeBackgroundPreference {
  if (!isRecord(value) || typeof value.kind !== "string") {
    throw new Error("Ungültige Home-Hintergrundwahl.");
  }
  if (value.kind === "none" && exactKeys(value, ["kind"])) {
    return Object.freeze({ kind: "none" });
  }
  if (value.kind === "preset") {
    if (
      !exactKeys(value, ["kind", "presetId"]) ||
      typeof value.presetId !== "string" ||
      !HOME_PRESET_IDS.has(value.presetId)
    ) {
      throw new Error("Nicht unterstütztes Home-Hintergrundbild.");
    }
    return Object.freeze({ kind: "preset", presetId: value.presetId as HomeBackgroundPresetId });
  }
  if (value.kind === "custom" && exactKeys(value, ["kind"])) {
    return Object.freeze({ kind: "custom" });
  }
  throw new Error("Nicht unterstütztes Home-Hintergrundbild.");
}

export function parseHomeAppHubSettings(value: unknown): HomeAppHubSettings {
  if (
    !isRecord(value) ||
    !exactKeys(value, ["schemaVersion", "order", "nameOverrides", "background"]) ||
    value.schemaVersion !== 1 ||
    !Array.isArray(value.order) ||
    value.order.length > HOME_MAX_APP_IDS ||
    !isRecord(value.nameOverrides) ||
    Object.keys(value.nameOverrides).length > HOME_MAX_NAME_OVERRIDES
  ) {
    throw new Error("Ungültige lokale Home-Einstellungen.");
  }

  const order: string[] = [];
  const seen = new Set<string>();
  for (const candidate of value.order) {
    if (!validHomeAppId(candidate) || seen.has(candidate)) {
      throw new Error("Ungültige oder doppelte Home-App-Reihenfolge.");
    }
    seen.add(candidate);
    order.push(candidate);
  }

  const nameOverrides: Record<string, string> = {};
  for (const [appId, rawName] of Object.entries(value.nameOverrides)) {
    if (!validHomeAppId(appId)) throw new Error("Ungültige Home-App-Referenz.");
    nameOverrides[appId] = normalizeHomeAppName(rawName);
  }

  return Object.freeze({
    schemaVersion: 1,
    order: Object.freeze(order),
    nameOverrides: Object.freeze(nameOverrides),
    background: parseBackgroundPreference(value.background),
  });
}

export function homeAppHubSettingsStorageKey(userId: string) {
  if (!userId.trim()) throw new Error("Ein angemeldetes Alo-Konto ist erforderlich.");
  return scopedStorageKey("alo-home-app-hub-settings-v1", userId);
}

export function loadHomeAppHubSettings(
  storage: Pick<HomeAppHubStorage, "getItem">,
  userId: string,
): HomeAppHubSettings {
  const raw = storage.getItem(homeAppHubSettingsStorageKey(userId));
  if (raw === null || raw.length > HOME_MAX_SETTINGS_BYTES) return EMPTY_HOME_APP_HUB_SETTINGS;
  try {
    return parseHomeAppHubSettings(JSON.parse(raw) as unknown);
  } catch {
    return EMPTY_HOME_APP_HUB_SETTINGS;
  }
}

export function saveHomeAppHubSettings(
  storage: Pick<HomeAppHubStorage, "setItem">,
  userId: string,
  value: unknown,
) {
  const settings = parseHomeAppHubSettings(value);
  const serialized = JSON.stringify(settings);
  if (serialized.length > HOME_MAX_SETTINGS_BYTES) {
    throw new Error("Home-Einstellungen überschreiten das lokale Speicherlimit.");
  }
  storage.setItem(homeAppHubSettingsStorageKey(userId), serialized);
}

export function orderHomeAppIds(appIds: readonly string[], savedOrder: readonly string[]) {
  const available = new Set(appIds);
  const ordered = savedOrder.filter((appId) => available.delete(appId));
  for (const appId of appIds) {
    if (available.delete(appId)) ordered.push(appId);
  }
  return Object.freeze(ordered);
}

export function moveHomeApp(
  settingsInput: unknown,
  visibleAppIds: readonly string[],
  appId: string,
  direction: -1 | 1,
): HomeAppHubSettings {
  if (direction !== -1 && direction !== 1) throw new Error("Ungültige Verschieberichtung.");
  const settings = parseHomeAppHubSettings(settingsInput);
  const order = [...orderHomeAppIds(visibleAppIds, settings.order)];
  const index = order.indexOf(appId);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= order.length) return settings;
  [order[index], order[nextIndex]] = [order[nextIndex]!, order[index]!];
  return parseHomeAppHubSettings({ ...settings, order });
}

export function moveHomeAppRelative(
  settingsInput: unknown,
  visibleAppIds: readonly string[],
  appId: string,
  targetAppId: string,
  placement: "before" | "after",
): HomeAppHubSettings {
  const settings = parseHomeAppHubSettings(settingsInput);
  if (appId === targetAppId) return settings;
  const order = [...orderHomeAppIds(visibleAppIds, settings.order)];
  const fromIndex = order.indexOf(appId);
  const targetIndex = order.indexOf(targetAppId);
  if (fromIndex < 0 || targetIndex < 0) return settings;
  order.splice(fromIndex, 1);
  const indexAfterRemoval = fromIndex < targetIndex ? targetIndex - 1 : targetIndex;
  order.splice(indexAfterRemoval + (placement === "after" ? 1 : 0), 0, appId);
  return parseHomeAppHubSettings({ ...settings, order });
}

export function setHomeAppName(
  settingsInput: unknown,
  appId: string,
  nameInput: unknown,
): HomeAppHubSettings {
  if (!validHomeAppId(appId)) throw new Error("Ungültige Alo-App.");
  const settings = parseHomeAppHubSettings(settingsInput);
  const name = normalizeHomeAppName(nameInput);
  return parseHomeAppHubSettings({
    ...settings,
    nameOverrides: { ...settings.nameOverrides, [appId]: name },
  });
}

export function clearHomeAppName(settingsInput: unknown, appId: string): HomeAppHubSettings {
  if (!validHomeAppId(appId)) throw new Error("Ungültige Alo-App.");
  const settings = parseHomeAppHubSettings(settingsInput);
  const nameOverrides = { ...settings.nameOverrides };
  delete nameOverrides[appId];
  return parseHomeAppHubSettings({ ...settings, nameOverrides });
}

export function forgetHomeAppPersonalization(
  settingsInput: unknown,
  appId: string,
): HomeAppHubSettings {
  if (!validHomeAppId(appId)) throw new Error("Ungültige Alo-App.");
  const settings = parseHomeAppHubSettings(settingsInput);
  const nameOverrides = { ...settings.nameOverrides };
  delete nameOverrides[appId];
  return parseHomeAppHubSettings({
    ...settings,
    order: settings.order.filter((savedId) => savedId !== appId),
    nameOverrides,
  });
}

export function setHomeBackground(
  settingsInput: unknown,
  backgroundInput: unknown,
): HomeAppHubSettings {
  const settings = parseHomeAppHubSettings(settingsInput);
  return parseHomeAppHubSettings({ ...settings, background: backgroundInput });
}

export type HomeBackgroundImagePlan = Readonly<{
  width: number;
  height: number;
  mimeType: "image/webp";
  quality: number;
}>;

export function planHomeBackgroundImage(
  mimeType: unknown,
  fileSize: unknown,
  sourceWidth: unknown,
  sourceHeight: unknown,
): HomeBackgroundImagePlan {
  if (typeof mimeType !== "string" || !HOME_IMAGE_TYPES.has(mimeType)) {
    throw new Error("Bitte wähle ein JPEG-, PNG- oder WebP-Bild. SVG-Dateien sind nicht erlaubt.");
  }
  if (
    typeof fileSize !== "number" ||
    !Number.isFinite(fileSize) ||
    fileSize <= 0 ||
    fileSize > HOME_BACKGROUND_MAX_UPLOAD_BYTES
  ) {
    throw new Error("Das Bild muss kleiner als 10 MB sein.");
  }
  if (
    typeof sourceWidth !== "number" ||
    typeof sourceHeight !== "number" ||
    !Number.isInteger(sourceWidth) ||
    !Number.isInteger(sourceHeight) ||
    sourceWidth < 1 ||
    sourceHeight < 1 ||
    sourceWidth > HOME_BACKGROUND_MAX_SOURCE_DIMENSION ||
    sourceHeight > HOME_BACKGROUND_MAX_SOURCE_DIMENSION ||
    sourceWidth * sourceHeight > HOME_BACKGROUND_MAX_PIXELS
  ) {
    throw new Error("Die Bildauflösung ist zu groß oder ungültig.");
  }
  const scale = Math.min(
    1,
    HOME_BACKGROUND_MAX_OUTPUT_DIMENSION / Math.max(sourceWidth, sourceHeight),
  );
  return Object.freeze({
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
    mimeType: "image/webp",
    quality: 0.82,
  });
}

export type HomeBackgroundImageDimensions = Readonly<{ width: number; height: number }>;

function readUint16BE(bytes: Uint8Array, offset: number) {
  return (bytes[offset]! << 8) | bytes[offset + 1]!;
}

function readUint16LE(bytes: Uint8Array, offset: number) {
  return bytes[offset]! | (bytes[offset + 1]! << 8);
}

function readUint32BE(bytes: Uint8Array, offset: number) {
  return (
    bytes[offset]! * 0x1000000 +
    (bytes[offset + 1]! << 16) +
    (bytes[offset + 2]! << 8) +
    bytes[offset + 3]!
  );
}

function readAscii(bytes: Uint8Array, offset: number, length: number) {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

function invalidImageHeader(): Error {
  return new Error("Das Bildformat oder seine Abmessungen konnten nicht sicher geprüft werden.");
}

/** Parses bounded raster headers before the browser allocates a decoded bitmap. */
export function readHomeBackgroundImageDimensions(
  mimeType: unknown,
  bytes: Uint8Array,
): HomeBackgroundImageDimensions {
  if (typeof mimeType !== "string" || !HOME_IMAGE_TYPES.has(mimeType)) {
    throw new Error("Bitte wähle ein JPEG-, PNG- oder WebP-Bild. SVG-Dateien sind nicht erlaubt.");
  }
  if (bytes.byteLength < 12 || bytes.byteLength > HOME_BACKGROUND_MAX_UPLOAD_BYTES) {
    throw invalidImageHeader();
  }

  let width = 0;
  let height = 0;
  if (mimeType === "image/png") {
    const signature = [137, 80, 78, 71, 13, 10, 26, 10];
    if (
      bytes.byteLength < 24 ||
      signature.some((byte, index) => bytes[index] !== byte) ||
      readAscii(bytes, 12, 4) !== "IHDR"
    ) {
      throw invalidImageHeader();
    }
    width = readUint32BE(bytes, 16);
    height = readUint32BE(bytes, 20);
  } else if (mimeType === "image/jpeg") {
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw invalidImageHeader();
    const startOfFrameMarkers = new Set([
      0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
    ]);
    let offset = 2;
    while (offset < bytes.byteLength) {
      if (bytes[offset] !== 0xff) throw invalidImageHeader();
      while (offset < bytes.byteLength && bytes[offset] === 0xff) offset += 1;
      if (offset >= bytes.byteLength) break;
      const marker = bytes[offset++]!;
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0x00) continue;
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 1 >= bytes.byteLength) throw invalidImageHeader();
      const segmentLength = readUint16BE(bytes, offset);
      if (segmentLength < 2 || offset + segmentLength > bytes.byteLength) {
        throw invalidImageHeader();
      }
      if (startOfFrameMarkers.has(marker)) {
        if (segmentLength < 8) throw invalidImageHeader();
        height = readUint16BE(bytes, offset + 3);
        width = readUint16BE(bytes, offset + 5);
        break;
      }
      offset += segmentLength;
    }
  } else {
    if (readAscii(bytes, 0, 4) !== "RIFF" || readAscii(bytes, 8, 4) !== "WEBP") {
      throw invalidImageHeader();
    }
    const chunkType = readAscii(bytes, 12, 4);
    if (chunkType === "VP8X" && bytes.byteLength >= 30) {
      width = 1 + bytes[24]! + (bytes[25]! << 8) + (bytes[26]! << 16);
      height = 1 + bytes[27]! + (bytes[28]! << 8) + (bytes[29]! << 16);
    } else if (
      chunkType === "VP8 " &&
      bytes.byteLength >= 30 &&
      bytes[23] === 0x9d &&
      bytes[24] === 0x01 &&
      bytes[25] === 0x2a
    ) {
      width = readUint16LE(bytes, 26) & 0x3fff;
      height = readUint16LE(bytes, 28) & 0x3fff;
    } else if (chunkType === "VP8L" && bytes.byteLength >= 25 && bytes[20] === 0x2f) {
      const b1 = bytes[21]!;
      const b2 = bytes[22]!;
      const b3 = bytes[23]!;
      const b4 = bytes[24]!;
      width = 1 + ((b2 & 0x3f) << 8) + b1;
      height = 1 + ((b4 & 0x0f) << 10) + (b3 << 2) + ((b2 & 0xc0) >> 6);
    } else {
      throw invalidImageHeader();
    }
  }

  planHomeBackgroundImage(mimeType, bytes.byteLength, width, height);
  return Object.freeze({ width, height });
}

export async function prepareHomeBackgroundImage(file: File): Promise<Blob> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") {
    throw new Error("Bildverarbeitung wird in diesem Browser nicht unterstützt.");
  }
  if (!HOME_IMAGE_TYPES.has(file.type) || file.size > HOME_BACKGROUND_MAX_UPLOAD_BYTES) {
    throw new Error("Bitte wähle ein JPEG-, PNG- oder WebP-Bild unter 10 MB.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const dimensions = readHomeBackgroundImageDimensions(file.type, bytes);
  const plan = planHomeBackgroundImage(file.type, file.size, dimensions.width, dimensions.height);
  const bitmap = await createImageBitmap(file, {
    resizeWidth: plan.width,
    resizeHeight: plan.height,
    resizeQuality: "high",
  });
  try {
    if (bitmap.width !== plan.width || bitmap.height !== plan.height) {
      throw new Error("Das Bild konnte nicht auf eine sichere Größe verkleinert werden.");
    }
    const canvas = document.createElement("canvas");
    canvas.width = plan.width;
    canvas.height = plan.height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Das Bild kann nicht verarbeitet werden.");
    context.drawImage(bitmap, 0, 0, plan.width, plan.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, plan.mimeType, plan.quality),
    );
    if (!blob || blob.size === 0 || blob.size > HOME_BACKGROUND_MAX_OUTPUT_BYTES) {
      throw new Error("Das komprimierte Bild ist zu groß. Bitte wähle ein kleineres Bild.");
    }
    return blob;
  } finally {
    bitmap.close();
  }
}

function homeBackgroundImageStorageKey(userId: string) {
  if (!userId.trim()) throw new Error("Ein angemeldetes Alo-Konto ist erforderlich.");
  return scopedStorageKey("alo-home-background-image-v1", userId);
}

function openHomeBackgroundDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(
      new Error("Lokale Bildspeicherung wird in diesem Browser nicht unterstützt."),
    );
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(HOME_BACKGROUND_DB_NAME, HOME_BACKGROUND_DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(HOME_BACKGROUND_OBJECT_STORE)) {
        database.createObjectStore(HOME_BACKGROUND_OBJECT_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Lokale Bildspeicherung fehlgeschlagen."));
    request.onblocked = () => reject(new Error("Lokale Bildspeicherung ist gerade blockiert."));
  });
}

async function withHomeBackgroundStore<T>(
  userId: string,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore, key: string) => IDBRequest<T>,
): Promise<T> {
  const database = await openHomeBackgroundDatabase();
  const key = homeBackgroundImageStorageKey(userId);
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(HOME_BACKGROUND_OBJECT_STORE, mode);
      const request = operation(transaction.objectStore(HOME_BACKGROUND_OBJECT_STORE), key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(request.error ?? new Error("Lokale Bildspeicherung fehlgeschlagen."));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("Lokale Bildspeicherung abgebrochen."));
    });
  } finally {
    database.close();
  }
}

export async function saveHomeBackgroundImage(userId: string, blob: Blob): Promise<void> {
  if (!(blob instanceof Blob) || blob.size === 0 || blob.size > HOME_BACKGROUND_MAX_OUTPUT_BYTES) {
    throw new Error("Ungültiges oder zu großes Home-Hintergrundbild.");
  }
  await withHomeBackgroundStore(userId, "readwrite", (store, key) => store.put(blob, key));
}

export async function loadHomeBackgroundImage(userId: string): Promise<Blob | null> {
  const result = await withHomeBackgroundStore<Blob | undefined>(userId, "readonly", (store, key) =>
    store.get(key),
  );
  return result instanceof Blob ? result : null;
}

export async function removeHomeBackgroundImage(userId: string): Promise<void> {
  await withHomeBackgroundStore(userId, "readwrite", (store, key) => store.delete(key));
}
