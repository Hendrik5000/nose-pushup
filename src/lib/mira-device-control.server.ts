import type {
  MiraDeviceCapability,
  MiraPermissionLevel,
  MiraDevicePlatform,
} from "./mira-device-control";

export type MiraGatewayDevice = {
  deviceId: string;
  name: string;
  platform: MiraDevicePlatform;
  fingerprint: string;
  agentVersion: string;
  createdAt: string;
  revokedAt: string | null;
  online: boolean;
  permissions: Record<MiraDeviceCapability, MiraPermissionLevel>;
};

export type MiraGatewayActivity = {
  id: string;
  at: string;
  kind: string;
  deviceId: string | null;
  toolId: string | null;
  status: string | null;
  detail: string | null;
};

export type MiraGatewaySnapshot = {
  configured: boolean;
  reachable: boolean;
  devices: MiraGatewayDevice[];
  activity: MiraGatewayActivity[];
  emergencyStopActive: boolean;
  gatewayUrl?: string;
  message?: string;
};

type GatewayConfig = { baseUrl: URL; adminToken: string };
type JsonRecord = Record<string, unknown>;

const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60_000;
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 256_000;
const requestsByUser = new Map<string, number[]>();

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function gatewayConfig(
  env: Record<string, string | undefined> = process.env,
): GatewayConfig | null {
  const rawUrl = env.MIRA_DEVICE_GATEWAY_URL?.trim();
  const adminToken = env.MIRA_DEVICE_GATEWAY_ADMIN_TOKEN?.trim();
  if (!rawUrl || !adminToken) return null;
  let baseUrl: URL;
  try {
    baseUrl = new URL(rawUrl);
  } catch {
    throw new Error("Die Gateway-Adresse ist ungültig.");
  }
  if (
    (env.NODE_ENV === "production" && baseUrl.protocol !== "https:") ||
    (baseUrl.protocol !== "https:" && baseUrl.protocol !== "http:") ||
    baseUrl.username ||
    baseUrl.password ||
    baseUrl.search ||
    baseUrl.hash ||
    (baseUrl.pathname !== "/" && baseUrl.pathname !== "")
  ) {
    throw new Error("Das Gateway muss über eine sichere HTTPS-Adresse erreichbar sein.");
  }
  if (adminToken.length < 32)
    throw new Error("Der Gateway-Admin-Token ist nicht ausreichend lang.");
  return { baseUrl, adminToken };
}

function enforceRateLimit(userId: string): void {
  const now = Date.now();
  const recent = (requestsByUser.get(userId) ?? []).filter((at) => now - at < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) throw new Error("Zu viele Geräteanfragen. Bitte kurz warten.");
  recent.push(now);
  requestsByUser.set(userId, recent);
  if (requestsByUser.size > 1000) {
    for (const [id, times] of requestsByUser) {
      if (!times.some((at) => now - at < RATE_WINDOW_MS)) requestsByUser.delete(id);
    }
  }
}

export async function requestMiraGateway(
  route: string,
  method: "GET" | "POST",
  userId: string,
  body?: JsonRecord,
): Promise<JsonRecord> {
  const config = gatewayConfig();
  if (!config) throw new Error("Das Mira Device Gateway ist noch nicht konfiguriert.");
  enforceRateLimit(userId);

  const url = new URL("/v1/control/" + route, config.baseUrl);
  if (method === "GET") url.searchParams.set("userId", userId);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method,
      redirect: "error",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        Authorization: "Bearer " + config.adminToken,
        ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
      },
      ...(method === "POST" ? { body: JSON.stringify({ ...body, userId }) } : {}),
    });
    const text = await response.text();
    if (text.length > MAX_RESPONSE_BYTES) throw new Error("Die Gateway-Antwort ist zu groß.");
    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error("Das Gateway hat eine ungültige Antwort geliefert.");
    }
    if (!response.ok) {
      const message =
        response.status === 401
          ? "Die Gateway-Authentifizierung ist fehlgeschlagen."
          : response.status === 404
            ? "Das Gerät oder der Gateway-Endpunkt wurde nicht gefunden."
            : response.status === 409
              ? "Die Aktion ist blockiert oder das Gerät ist offline."
              : response.status === 429
                ? "Das Gateway begrenzt gerade die Anfragen."
                : "Das Gateway ist vorübergehend nicht verfügbar.";
      throw new Error(message);
    }
    if (!isRecord(payload)) throw new Error("Das Gateway hat eine ungültige Antwort geliefert.");
    return payload;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Das Gateway antwortet nicht rechtzeitig.");
    }
    throw error instanceof Error ? error : new Error("Das Gateway ist nicht erreichbar.");
  } finally {
    clearTimeout(timer);
  }
}

const CAPABILITIES: MiraDeviceCapability[] = [
  "status",
  "programme",
  "fenster",
  "eingaben",
  "bildschirm",
  "dateien",
  "einstellungen",
  "audio",
];
const PERMISSION_LEVELS: MiraPermissionLevel[] = ["keine", "lesen", "steuern", "kritisch"];

function parsePermissions(
  value: unknown,
): Record<MiraDeviceCapability, MiraPermissionLevel> | null {
  if (!isRecord(value) || Object.keys(value).length !== CAPABILITIES.length) return null;
  const result = {} as Record<MiraDeviceCapability, MiraPermissionLevel>;
  for (const capability of CAPABILITIES) {
    const level = value[capability];
    if (!PERMISSION_LEVELS.includes(level as MiraPermissionLevel)) return null;
    result[capability] = level as MiraPermissionLevel;
  }
  return result;
}

function parseDevice(value: unknown): MiraGatewayDevice | null {
  if (!isRecord(value)) return null;
  const platform = value.platform;
  if (
    typeof value.deviceId !== "string" ||
    typeof value.name !== "string" ||
    (platform !== "windows" && platform !== "android" && platform !== "ipad") ||
    typeof value.fingerprint !== "string" ||
    typeof value.agentVersion !== "string" ||
    typeof value.createdAt !== "string" ||
    (value.revokedAt !== null && typeof value.revokedAt !== "string") ||
    typeof value.online !== "boolean"
  )
    return null;
  const permissions = parsePermissions(value.permissions);
  if (!permissions) return null;
  return {
    deviceId: value.deviceId,
    name: value.name.slice(0, 80),
    platform,
    fingerprint: value.fingerprint.slice(0, 32),
    agentVersion: value.agentVersion.slice(0, 50),
    createdAt: value.createdAt,
    revokedAt: value.revokedAt,
    online: value.online,
    permissions,
  };
}

function parseActivity(value: unknown, index: number): MiraGatewayActivity | null {
  if (!isRecord(value) || typeof value.at !== "string" || typeof value.kind !== "string")
    return null;
  return {
    id: value.at + "-" + index,
    at: value.at,
    kind: value.kind.slice(0, 40),
    deviceId: typeof value.deviceId === "string" ? value.deviceId : null,
    toolId: typeof value.toolId === "string" ? value.toolId.slice(0, 80) : null,
    status: typeof value.status === "string" ? value.status.slice(0, 80) : null,
    detail: typeof value.detail === "string" ? value.detail.slice(0, 300) : null,
  };
}

export async function fetchMiraGatewaySnapshot(userId: string): Promise<MiraGatewaySnapshot> {
  if (!gatewayConfig()) {
    return {
      configured: false,
      reachable: false,
      devices: [],
      activity: [],
      emergencyStopActive: false,
      message: "Gateway-Adresse und Admin-Token müssen serverseitig eingerichtet werden.",
    };
  }
  try {
    const [devicesResult, activityResult, stopResult] = await Promise.all([
      requestMiraGateway("devices", "GET", userId),
      requestMiraGateway("action-log", "GET", userId),
      requestMiraGateway("not-aus", "GET", userId),
    ]);
    const devices = Array.isArray(devicesResult.devices)
      ? devicesResult.devices
          .map(parseDevice)
          .filter(
            (device): device is MiraGatewayDevice => device !== null && device.revokedAt === null,
          )
      : [];
    const activity = Array.isArray(activityResult.entries)
      ? activityResult.entries
          .map(parseActivity)
          .filter((entry): entry is MiraGatewayActivity => entry !== null)
          .reverse()
      : [];
    return {
      configured: true,
      reachable: true,
      devices,
      activity,
      emergencyStopActive: stopResult.aktiv === true,
      gatewayUrl: gatewayConfig()?.baseUrl.origin,
    };
  } catch (error) {
    return {
      configured: true,
      reachable: false,
      devices: [],
      activity: [],
      emergencyStopActive: false,
      message: error instanceof Error ? error.message : "Das Gateway ist nicht erreichbar.",
    };
  }
}

export function isMiraGatewayConfigured(): boolean {
  return gatewayConfig() !== null;
}
