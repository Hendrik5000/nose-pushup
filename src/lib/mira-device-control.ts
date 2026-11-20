/**
 * Mira Device Control - Phase 1 (Device Control UI)
 *
 * Reine, lokale Planungslogik ohne Datenbank und ohne echte Fernsteuerung.
 * Gekoppelte Geraete bleiben bewusst im Zustand "gekoppelt-offline", bis ein
 * echtes Device Control Gateway existiert. Es werden keine Passwoerter oder
 * Geheimnisse gespeichert; der Speicher enthaelt nur Namen, Zustand,
 * Freigaben und ein minimales Aktivitaetsprotokoll.
 *
 * Auftrag und Regeln: Notion-Seite "Mira Device Control - Geraetesteurung fuer
 * Windows, Android & iPad" (Phase 1) sowie docs/AI-HANDOFF.md.
 */

export const MIRA_DEVICE_CONTROL_STORAGE_KEY = "mira-device-control:v1";

/**
 * Solange kein echtes Gateway existiert, duerfen Geraete niemals als
 * "verbunden" angezeigt werden (Abnahmekriterium Phase 1: echte
 * Verbindungszustaende nur bei tatsaechlicher Verbindung).
 */
export const DEVICE_CONTROL_GATEWAY_AVAILABLE = false;

export type MiraDevicePlatform = "windows" | "android" | "ipad";

export type MiraDeviceState =
  "nicht-gekoppelt" | "gekoppelt-offline" | "verbunden" | "pausiert" | "fehler";

export type MiraPermissionLevel = "keine" | "lesen" | "steuern" | "kritisch";

export type MiraDeviceCapability =
  | "status"
  | "programme"
  | "fenster"
  | "eingaben"
  | "bildschirm"
  | "dateien"
  | "einstellungen"
  | "audio";

export const MIRA_DEVICE_CAPABILITIES: ReadonlyArray<{
  id: MiraDeviceCapability;
  label: string;
  hint: string;
}> = [
  { id: "status", label: "Status", hint: "Verbindungs- und Freigabestatus anzeigen" },
  { id: "programme", label: "Programme", hint: "Programme und Browser starten oder schliessen" },
  { id: "fenster", label: "Fenster", hint: "Fenster wechseln und verwalten" },
  { id: "eingaben", label: "Eingaben", hint: "Maus- und Tastatureingaben ausfuehren" },
  {
    id: "bildschirm",
    label: "Bildschirm",
    hint: "Bildschirm nur auf ausdrueckliche Anfrage uebertragen",
  },
  {
    id: "dateien",
    label: "Dateien",
    hint: "Dateien und Ordner suchen, erstellen, umbenennen, verschieben",
  },
  {
    id: "einstellungen",
    label: "Einstellungen",
    hint: "Unterstuetzte Windows-Einstellungen oeffnen oder veraendern",
  },
  { id: "audio", label: "Audio", hint: "Lautstaerke und freigegebene Systemfunktionen steuern" },
];

export type MiraDeviceActivityKind =
  "info" | "kopplung" | "status" | "berechtigung" | "widerruf" | "not-aus";

export type MiraDeviceActivity = {
  id: string;
  at: string;
  deviceId: string | null;
  kind: MiraDeviceActivityKind;
  message: string;
};

export type MiraDevice = {
  id: string;
  name: string;
  platform: MiraDevicePlatform;
  state: MiraDeviceState;
  coupledAt: string | null;
  couplingCode: string | null;
  permissions: Record<MiraDeviceCapability, MiraPermissionLevel>;
};

export type MiraDeviceStore = {
  devices: MiraDevice[];
  activity: MiraDeviceActivity[];
  emergencyStopActive: boolean;
};

export const MIRA_PLATFORM_LABELS: Record<MiraDevicePlatform, string> = {
  windows: "Windows 11 (erste Plattform)",
  android: "Android (geplant)",
  ipad: "iPad (geplant)",
};

const DEFAULT_PERMISSIONS: Record<MiraDeviceCapability, MiraPermissionLevel> = {
  status: "lesen",
  programme: "keine",
  fenster: "keine",
  eingaben: "keine",
  bildschirm: "keine",
  dateien: "keine",
  einstellungen: "keine",
  audio: "keine",
};

let activityCounter = 0;

export function createEmptyStore(): MiraDeviceStore {
  return { devices: [], activity: [], emergencyStopActive: false };
}

export function appendActivity(
  store: MiraDeviceStore,
  kind: MiraDeviceActivityKind,
  message: string,
  deviceId: string | null = null,
  at: string = new Date().toISOString(),
): MiraDeviceStore {
  activityCounter += 1;
  const entry: MiraDeviceActivity = {
    id: "act-" + activityCounter + "-" + Math.random().toString(36).slice(2, 8),
    at,
    deviceId,
    kind,
    message,
  };
  return { ...store, activity: [entry, ...store.activity].slice(0, 50) };
}

export function generateCouplingCode(random: () => number = Math.random): string {
  return Math.floor(random() * 1000000)
    .toString()
    .padStart(6, "0");
}

export function coupleDevice(
  store: MiraDeviceStore,
  name: string,
  platform: MiraDevicePlatform,
  at: string = new Date().toISOString(),
): { store: MiraDeviceStore; device: MiraDevice } {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Geraetename fehlt.");
  const device: MiraDevice = {
    id: "dev-" + Math.random().toString(36).slice(2, 10),
    name: trimmed,
    platform,
    state: "gekoppelt-offline",
    coupledAt: at,
    // Nur ein lokaler Kopplungscode fuer die Phase-1-Vorschau. Er gewaehrt
    // keinen Zugriff und ist kein Authentifizierungsmechanismus.
    couplingCode: generateCouplingCode(),
    permissions: { ...DEFAULT_PERMISSIONS },
  };
  const next = appendActivity(
    { ...store, devices: [...store.devices, device] },
    "kopplung",
    "Geraet '" +
      trimmed +
      "' (" +
      MIRA_PLATFORM_LABELS[platform] +
      ") gekoppelt. Es ist noch offline, bis ein echtes Gateway existiert.",
    device.id,
    at,
  );
  return { store: next, device };
}

export function setDevicePermission(
  store: MiraDeviceStore,
  deviceId: string,
  capability: MiraDeviceCapability,
  level: MiraPermissionLevel,
): MiraDeviceStore {
  const device = store.devices.find((d) => d.id === deviceId);
  if (!device) throw new Error("Geraet nicht gefunden.");
  const label = MIRA_DEVICE_CAPABILITIES.find((c) => c.id === capability)?.label ?? capability;
  const devices = store.devices.map((d) =>
    d.id === deviceId ? { ...d, permissions: { ...d.permissions, [capability]: level } } : d,
  );
  return appendActivity(
    { ...store, devices },
    "berechtigung",
    "Berechtigung '" + label + "' fuer '" + device.name + "' gesetzt auf: " + level + ".",
    deviceId,
  );
}

export function setDeviceState(
  store: MiraDeviceStore,
  deviceId: string,
  state: MiraDeviceState,
): MiraDeviceStore {
  const device = store.devices.find((d) => d.id === deviceId);
  if (!device) throw new Error("Geraet nicht gefunden.");
  if (state === "verbunden" && !DEVICE_CONTROL_GATEWAY_AVAILABLE) {
    // Abnahmekriterium: niemals "verbunden" anzeigen, solange keine echte
    // Verbindung besteht.
    throw new Error(
      "Es existiert kein echtes Device Control Gateway; Geraete koennen nicht als 'verbunden' markiert werden.",
    );
  }
  const devices = store.devices.map((d) => (d.id === deviceId ? { ...d, state } : d));
  return appendActivity(
    { ...store, devices },
    "status",
    "Status von '" + device.name + "' auf '" + state + "' gesetzt.",
    deviceId,
  );
}

export function pauseDevice(store: MiraDeviceStore, deviceId: string): MiraDeviceStore {
  return setDeviceState(store, deviceId, "pausiert");
}

export function resumeDevice(store: MiraDeviceStore, deviceId: string): MiraDeviceStore {
  // Nach dem Fortsetzen bleibt das Geraet offline, bis ein echtes Gateway
  // eine Verbindung meldet.
  return setDeviceState(store, deviceId, "gekoppelt-offline");
}

export function revokeDevice(store: MiraDeviceStore, deviceId: string): MiraDeviceStore {
  const device = store.devices.find((d) => d.id === deviceId);
  if (!device) throw new Error("Geraet nicht gefunden.");
  const devices = store.devices.filter((d) => d.id !== deviceId);
  return appendActivity(
    { ...store, devices },
    "widerruf",
    "Kopplung von '" + device.name + "' widerrufen; Berechtigungen entfernt.",
    null,
  );
}

export function triggerEmergencyStop(
  store: MiraDeviceStore,
  at: string = new Date().toISOString(),
): MiraDeviceStore {
  const devices = store.devices.map((d) => ({ ...d, state: "pausiert" as MiraDeviceState }));
  return appendActivity(
    { ...store, devices, emergencyStopActive: true },
    "not-aus",
    "Not-Aus ausgeloest: alle Geraateverbindungen pausiert.",
    null,
    at,
  );
}

export function clearEmergencyStop(store: MiraDeviceStore): MiraDeviceStore {
  return appendActivity(
    { ...store, emergencyStopActive: false },
    "not-aus",
    "Not-Aus zurueckgesetzt; Geraete bleiben pausiert und koennen manuell fortgesetzt werden.",
  );
}

export function describeDeviceState(state: MiraDeviceState): string {
  switch (state) {
    case "nicht-gekoppelt":
      return "Nicht gekoppelt";
    case "gekoppelt-offline":
      return "Gekoppelt (offline)";
    case "verbunden":
      return "Verbunden";
    case "pausiert":
      return "Pausiert";
    case "fehler":
      return "Fehler";
  }
}

/* --- Persistenz (nur lokal, ohne Geheimnisse) --- */

function isMiraDeviceStore(value: unknown): value is MiraDeviceStore {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Partial<MiraDeviceStore>;
  return (
    Array.isArray(v.devices) &&
    Array.isArray(v.activity) &&
    typeof v.emergencyStopActive === "boolean"
  );
}

export function saveMiraDeviceStore(
  store: MiraDeviceStore,
  storage: Pick<Storage, "setItem"> | null,
): void {
  if (!storage) return;
  try {
    storage.setItem(MIRA_DEVICE_CONTROL_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Speichern ist optional; die Phase-1-UI funktioniert auch ohne Persistenz.
  }
}

export function loadMiraDeviceStore(storage: Pick<Storage, "getItem"> | null): MiraDeviceStore {
  if (!storage) return createEmptyStore();
  try {
    const raw = storage.getItem(MIRA_DEVICE_CONTROL_STORAGE_KEY);
    if (!raw) return createEmptyStore();
    const parsed: unknown = JSON.parse(raw);
    return isMiraDeviceStore(parsed) ? parsed : createEmptyStore();
  } catch {
    return createEmptyStore();
  }
}
