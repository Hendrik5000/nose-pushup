import { scopedStorageKey } from "@/integrations/supabase/backendScope";

export const HOME_BACKGROUND_PRESETS = [
  {
    id: "aurora",
    label: "Polarlicht",
    background:
      "radial-gradient(circle at 18% 12%, rgba(94, 234, 212, 0.30), transparent 38%), linear-gradient(135deg, #0b1723, #252344 58%, #11151b)",
  },
  {
    id: "dawn",
    label: "Morgenlicht",
    background:
      "radial-gradient(circle at 80% 10%, rgba(251, 191, 153, 0.28), transparent 42%), linear-gradient(135deg, #241b25, #3a2b36 54%, #17191f)",
  },
  {
    id: "forest",
    label: "Wald",
    background:
      "radial-gradient(circle at 20% 14%, rgba(134, 239, 172, 0.24), transparent 40%), linear-gradient(135deg, #10251e, #1b302d 55%, #12171b)",
  },
  {
    id: "ocean",
    label: "Ozean",
    background:
      "radial-gradient(circle at 76% 14%, rgba(103, 232, 249, 0.26), transparent 42%), linear-gradient(135deg, #10212d, #153344 55%, #12171b)",
  },
] as const;

export type HomeBackgroundPresetId = (typeof HOME_BACKGROUND_PRESETS)[number]["id"];
export type HomeBackgroundChoice = "none" | HomeBackgroundPresetId;
export type HomeAppCustomizationSettings = Readonly<{
  schemaVersion: 1;
  order: readonly string[];
  nameOverrides: Readonly<Record<string, string>>;
  background: HomeBackgroundChoice;
}>;
export type HomeAppCustomizationStorage = Pick<Storage, "getItem" | "setItem">;

export const EMPTY_HOME_APP_CUSTOMIZATION: HomeAppCustomizationSettings = Object.freeze({
  schemaVersion: 1,
  order: Object.freeze([]),
  nameOverrides: Object.freeze({}),
  background: "none",
});

const HOME_APP_ID_PATTERN = /^[a-z][a-z0-9-]{0,47}$/i;
const HOME_NAME_MAX_CHARS = 48;
const MAX_HOME_APP_IDS = 64;
const MAX_HOME_NAME_OVERRIDES = 64;
const MAX_SETTINGS_LENGTH = 16_384;
const BACKGROUND_CHOICES = new Set<string>([
  "none",
  ...HOME_BACKGROUND_PRESETS.map(({ id }) => id),
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function normalizeAppName(value: unknown) {
  if (typeof value !== "string") throw new Error("Der App-Name muss Text sein.");
  const name = value.normalize("NFC").trim();
  const hasUnsafeCharacter = Array.from(name).some((character) => {
    const code = character.charCodeAt(0);
    return character === "<" || character === ">" || code <= 0x1f || (code >= 0x7f && code <= 0x9f);
  });
  if (!name || name.length > HOME_NAME_MAX_CHARS || hasUnsafeCharacter) {
    throw new Error("Der App-Name ist leer, zu lang oder enthält ungültige Zeichen.");
  }
  return name;
}

export function parseHomeAppCustomizationSettings(value: unknown): HomeAppCustomizationSettings {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["schemaVersion", "order", "nameOverrides", "background"]) ||
    value.schemaVersion !== 1 ||
    !Array.isArray(value.order) ||
    value.order.length > MAX_HOME_APP_IDS ||
    !isRecord(value.nameOverrides) ||
    Object.keys(value.nameOverrides).length > MAX_HOME_NAME_OVERRIDES ||
    typeof value.background !== "string" ||
    !BACKGROUND_CHOICES.has(value.background)
  ) {
    throw new Error("Ungültige lokale Home-Einstellungen.");
  }

  const order: string[] = [];
  const seen = new Set<string>();
  for (const candidate of value.order) {
    if (
      typeof candidate !== "string" ||
      !HOME_APP_ID_PATTERN.test(candidate) ||
      seen.has(candidate)
    ) {
      throw new Error("Ungültige oder doppelte Home-App-Reihenfolge.");
    }
    seen.add(candidate);
    order.push(candidate);
  }

  const nameOverrides: Record<string, string> = {};
  for (const [appId, rawName] of Object.entries(value.nameOverrides)) {
    if (!HOME_APP_ID_PATTERN.test(appId)) throw new Error("Ungültige Home-App-Referenz.");
    nameOverrides[appId] = normalizeAppName(rawName);
  }

  return Object.freeze({
    schemaVersion: 1,
    order: Object.freeze(order),
    nameOverrides: Object.freeze(nameOverrides),
    background: value.background as HomeBackgroundChoice,
  });
}

export function homeAppCustomizationStorageKey(userId: string) {
  if (!userId.trim()) throw new Error("Ein angemeldetes Alo-Konto ist erforderlich.");
  return scopedStorageKey("alo-home-app-customization-v1", userId);
}

export function loadHomeAppCustomization(
  storage: Pick<HomeAppCustomizationStorage, "getItem">,
  userId: string,
): HomeAppCustomizationSettings {
  if (!userId.trim()) return EMPTY_HOME_APP_CUSTOMIZATION;
  try {
    const raw = storage.getItem(homeAppCustomizationStorageKey(userId));
    if (raw === null || raw.length > MAX_SETTINGS_LENGTH) return EMPTY_HOME_APP_CUSTOMIZATION;
    return parseHomeAppCustomizationSettings(JSON.parse(raw) as unknown);
  } catch {
    return EMPTY_HOME_APP_CUSTOMIZATION;
  }
}

export function saveHomeAppCustomization(
  storage: Pick<HomeAppCustomizationStorage, "setItem">,
  userId: string,
  value: unknown,
) {
  const settings = parseHomeAppCustomizationSettings(value);
  const serialized = JSON.stringify(settings);
  if (serialized.length > MAX_SETTINGS_LENGTH) {
    throw new Error("Die lokalen Home-Einstellungen überschreiten das Speicherlimit.");
  }
  storage.setItem(homeAppCustomizationStorageKey(userId), serialized);
  return settings;
}

export function orderHomeAppIds(appIds: readonly string[], savedOrder: readonly string[]) {
  const remaining = new Set(appIds);
  const ordered = savedOrder.filter((appId) => {
    if (!remaining.has(appId)) return false;
    remaining.delete(appId);
    return true;
  });
  for (const appId of appIds) {
    if (remaining.delete(appId)) ordered.push(appId);
  }
  return Object.freeze(ordered);
}

export function moveHomeApp(
  settingsInput: unknown,
  visibleAppIds: readonly string[],
  appId: string,
  direction: -1 | 1,
): HomeAppCustomizationSettings {
  if (direction !== -1 && direction !== 1) throw new Error("Ungültige Verschieberichtung.");
  const settings = parseHomeAppCustomizationSettings(settingsInput);
  const order = [...orderHomeAppIds(visibleAppIds, settings.order)];
  const index = order.indexOf(appId);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= order.length) return settings;
  [order[index], order[nextIndex]] = [order[nextIndex]!, order[index]!];
  return parseHomeAppCustomizationSettings({ ...settings, order });
}

export function setHomeAppName(
  settingsInput: unknown,
  appId: string,
  nameInput: unknown,
): HomeAppCustomizationSettings {
  if (!HOME_APP_ID_PATTERN.test(appId)) throw new Error("Ungültige Alo-App.");
  const settings = parseHomeAppCustomizationSettings(settingsInput);
  const name = normalizeAppName(nameInput);
  return parseHomeAppCustomizationSettings({
    ...settings,
    nameOverrides: { ...settings.nameOverrides, [appId]: name },
  });
}

export function clearHomeAppName(settingsInput: unknown, appId: string) {
  if (!HOME_APP_ID_PATTERN.test(appId)) throw new Error("Ungültige Alo-App.");
  const settings = parseHomeAppCustomizationSettings(settingsInput);
  const nameOverrides = { ...settings.nameOverrides };
  delete nameOverrides[appId];
  return parseHomeAppCustomizationSettings({ ...settings, nameOverrides });
}

export function setHomeBackground(
  settingsInput: unknown,
  background: unknown,
): HomeAppCustomizationSettings {
  const settings = parseHomeAppCustomizationSettings(settingsInput);
  if (typeof background !== "string" || !BACKGROUND_CHOICES.has(background)) {
    throw new Error("Nicht unterstützter Startseitenhintergrund.");
  }
  return parseHomeAppCustomizationSettings({ ...settings, background });
}
