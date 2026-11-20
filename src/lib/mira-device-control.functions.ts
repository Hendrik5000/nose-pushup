import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fetchMiraGatewaySnapshot, requestMiraGateway } from "@/lib/mira-device-control.server";
import type {
  MiraDeviceCapability,
  MiraPermissionLevel,
  MiraDevicePlatform,
} from "@/lib/mira-device-control";

type RecordValue = Record<string, unknown>;
type ActionRequest = {
  action: "dispatch";
  deviceId: string;
  toolId: string;
  args: RecordValue;
  confirmation: boolean;
};
type MutationRequest =
  | { action: "pairing-code"; name: string; platform: MiraDevicePlatform }
  | {
      action: "permissions";
      deviceId: string;
      permissions: Record<MiraDeviceCapability, MiraPermissionLevel>;
    }
  | { action: "not-aus"; active: boolean; reason: string }
  | { action: "revoke"; deviceId: string; reason: string }
  | ActionRequest
  | { action: "screen"; deviceId: string; active: boolean };

function record(value: unknown, allowed: string[]): RecordValue {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !allowed.includes(key))
  )
    throw new Error("Ungültige Geräteanfrage.");
  return value as RecordValue;
}

function string(value: unknown, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw new Error("Ungültige Geräteanfrage.");
  }
  return value.trim();
}

function integer(value: unknown, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new Error("Ungültige Geräteanfrage.");
  }
  return value;
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
const LEVELS: MiraPermissionLevel[] = ["keine", "lesen", "steuern", "kritisch"];
const APPS = [
  "notepad",
  "calc",
  "explorer",
  "mspaint",
  "msedge",
  "chrome",
  "firefox",
  "code",
  "steam",
  "discord",
];
const SETTINGS = [
  "display",
  "sound",
  "network",
  "bluetooth",
  "windows-update",
  "apps",
  "personalization",
  "privacy",
];
const KEYS = [
  "ENTER",
  "TAB",
  "ESC",
  "BACKSPACE",
  "DELETE",
  "UP",
  "DOWN",
  "LEFT",
  "RIGHT",
  "HOME",
  "END",
  "PAGEUP",
  "PAGEDOWN",
  "F5",
  "CTRL+C",
  "CTRL+V",
  "CTRL+S",
  "CTRL+Z",
  "ALT+TAB",
];
const TOOLS = new Set([
  "status.ping",
  "status.info",
  "programme.liste",
  "programme.starten",
  "programme.beenden",
  "fenster.liste",
  "fenster.fokussieren",
  "fenster.minimieren",
  "fenster.maximieren",
  "eingabe.maus",
  "eingabe.tastatur",
  "dateien.auflisten",
  "dateien.lesen",
  "dateien.schreiben",
  "dateien.umbenennen",
  "dateien.verschieben",
  "einstellungen.oeffnen",
  "einstellungen.herunterfahren",
  "einstellungen.abbrechen-herunterfahren",
  "audio.lautstaerke",
  "audio.stummschalten",
]);

function permissionMap(value: unknown): Record<MiraDeviceCapability, MiraPermissionLevel> {
  const v = record(value, CAPABILITIES);
  if (Object.keys(v).length !== CAPABILITIES.length) throw new Error("Ungültige Berechtigungen.");
  const result = {} as Record<MiraDeviceCapability, MiraPermissionLevel>;
  for (const capability of CAPABILITIES) {
    if (!LEVELS.includes(v[capability] as MiraPermissionLevel))
      throw new Error("Ungültige Berechtigungen.");
    result[capability] = v[capability] as MiraPermissionLevel;
  }
  return result;
}

function validateActionArgs(
  toolId: string,
  value: unknown,
): { args: RecordValue; confirmation: boolean } {
  if (!TOOLS.has(toolId)) throw new Error("Dieses Mira-Werkzeug ist nicht freigegeben.");
  const v = value === undefined ? {} : value;
  const critical = new Set([
    "programme.beenden",
    "dateien.schreiben",
    "dateien.umbenennen",
    "dateien.verschieben",
    "einstellungen.herunterfahren",
  ]).has(toolId);
  let args: RecordValue;
  switch (toolId) {
    case "status.ping":
    case "status.info":
    case "programme.liste":
    case "fenster.liste":
    case "audio.stummschalten":
    case "einstellungen.abbrechen-herunterfahren":
      args = record(v, []);
      break;
    case "programme.starten": {
      args = record(v, ["app"]);
      if (typeof args.app !== "string" || !APPS.includes(args.app))
        throw new Error("Programm ist nicht freigegeben.");
      break;
    }
    case "programme.beenden":
      args = record(v, ["processId"]);
      args.processId = integer(args.processId, 1, 2_147_483_647);
      break;
    case "fenster.fokussieren":
    case "fenster.minimieren":
    case "fenster.maximieren":
      args = record(v, ["handle"]);
      args.handle = string(args.handle, 32);
      if (!/^[0-9a-f]+$/i.test(args.handle)) throw new Error("Ungültige Fensterkennung.");
      break;
    case "eingabe.maus":
      args = record(v, ["action", "x", "y", "button"]);
      if (args.action !== "move" && args.action !== "click")
        throw new Error("Ungültige Mausaktion.");
      args.x = integer(args.x, 0, 10_000);
      args.y = integer(args.y, 0, 10_000);
      if (args.button !== undefined && !["left", "right", "middle"].includes(String(args.button)))
        throw new Error("Ungültiger Mausbutton.");
      break;
    case "eingabe.tastatur":
      args = record(v, ["key", "text"]);
      if (typeof args.text === "string" && args.text.length > 500)
        throw new Error("Text ist zu lang.");
      if (args.text === undefined && (typeof args.key !== "string" || !KEYS.includes(args.key)))
        throw new Error("Taste ist nicht freigegeben.");
      if (args.text !== undefined && args.key !== undefined)
        throw new Error("Nur Text oder Taste senden.");
      break;
    case "dateien.auflisten":
    case "dateien.lesen":
      args = record(v, ["root", "path"]);
      if (!["Desktop", "Documents", "Downloads"].includes(String(args.root)))
        throw new Error("Ordner ist nicht freigegeben.");
      if (args.path !== undefined && (typeof args.path !== "string" || args.path.length > 500))
        throw new Error("Ungültiger Dateipfad.");
      break;
    case "dateien.schreiben":
      args = record(v, ["root", "path", "content"]);
      if (!["Desktop", "Documents", "Downloads"].includes(String(args.root)))
        throw new Error("Ordner ist nicht freigegeben.");
      if (
        typeof args.path !== "string" ||
        args.path.length > 500 ||
        typeof args.content !== "string" ||
        args.content.length > 16_384
      )
        throw new Error("Ungültige Dateiaktion.");
      break;
    case "dateien.umbenennen":
      args = record(v, ["root", "path", "newName"]);
      if (!["Desktop", "Documents", "Downloads"].includes(String(args.root)))
        throw new Error("Ordner ist nicht freigegeben.");
      if (
        typeof args.path !== "string" ||
        args.path.length > 500 ||
        typeof args.newName !== "string" ||
        args.newName.length > 120
      )
        throw new Error("Ungültige Dateiaktion.");
      break;
    case "dateien.verschieben":
      args = record(v, ["sourceRoot", "sourcePath", "destinationRoot", "destinationPath"]);
      if (
        !["Desktop", "Documents", "Downloads"].includes(String(args.sourceRoot)) ||
        !["Desktop", "Documents", "Downloads"].includes(String(args.destinationRoot))
      )
        throw new Error("Ordner ist nicht freigegeben.");
      if (
        typeof args.sourcePath !== "string" ||
        args.sourcePath.length > 500 ||
        typeof args.destinationPath !== "string" ||
        args.destinationPath.length > 500
      )
        throw new Error("Ungültiger Dateipfad.");
      break;
    case "einstellungen.oeffnen":
      args = record(v, ["page"]);
      if (typeof args.page !== "string" || !SETTINGS.includes(args.page))
        throw new Error("Einstellungsseite ist nicht freigegeben.");
      break;
    case "einstellungen.herunterfahren":
      args = record(v, []);
      break;
    case "audio.lautstaerke":
      args = record(v, ["direction", "steps"]);
      if (args.direction !== "up" && args.direction !== "down")
        throw new Error("Ungültige Lautstärkeaktion.");
      args.steps = integer(args.steps, 1, 10);
      break;
    default:
      throw new Error("Dieses Mira-Werkzeug ist nicht freigegeben.");
  }
  return { args, confirmation: critical };
}

export const miraDeviceControlState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => fetchMiraGatewaySnapshot(context.userId));

export const miraDeviceControlMutation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input): MutationRequest => {
    const v = record(input, [
      "action",
      "name",
      "platform",
      "deviceId",
      "permissions",
      "active",
      "reason",
      "toolId",
      "args",
      "confirmation",
    ]);
    if (v.action === "pairing-code") {
      if (v.platform !== "windows" && v.platform !== "android" && v.platform !== "ipad")
        throw new Error("Plattform ungültig.");
      return { action: "pairing-code", name: string(v.name, 80), platform: v.platform };
    }
    if (v.action === "permissions") {
      return {
        action: "permissions",
        deviceId: string(v.deviceId, 80),
        permissions: permissionMap(v.permissions),
      };
    }
    if (v.action === "not-aus") {
      if (typeof v.active !== "boolean") throw new Error("Ungültige Not-Aus-Anfrage.");
      return {
        action: "not-aus",
        active: v.active,
        reason: typeof v.reason === "string" ? v.reason.slice(0, 200) : "",
      };
    }
    if (v.action === "revoke") {
      return {
        action: "revoke",
        deviceId: string(v.deviceId, 80),
        reason: typeof v.reason === "string" ? v.reason.slice(0, 200) : "",
      };
    }
    if (v.action === "screen") {
      if (typeof v.active !== "boolean") throw new Error("Ungültige Bildschirm-Sitzung.");
      return { action: "screen", deviceId: string(v.deviceId, 80), active: v.active };
    }
    if (v.action === "dispatch") {
      const deviceId = string(v.deviceId, 80);
      const toolId = string(v.toolId, 80);
      const checked = validateActionArgs(toolId, v.args);
      if (checked.confirmation && v.confirmation !== true)
        throw new Error("Für diese Aktion ist eine ausdrückliche Bestätigung erforderlich.");
      return {
        action: "dispatch",
        deviceId,
        toolId,
        args: checked.args,
        confirmation: checked.confirmation,
      };
    }
    throw new Error("Unbekannte Geräteaktion.");
  })
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    if (data.action === "pairing-code") {
      const result = await requestMiraGateway("pairing-code", "POST", userId);
      if (typeof result.code !== "string" || typeof result.expiresAt !== "string")
        throw new Error("Ungültige Gateway-Antwort.");
      return {
        action: data.action,
        code: result.code,
        expiresAt: result.expiresAt,
        deviceName: data.name,
        platform: data.platform,
      };
    }
    if (data.action === "permissions") {
      return {
        action: data.action,
        ...(await requestMiraGateway("permissions", "POST", userId, {
          deviceId: data.deviceId,
          permissions: data.permissions,
        })),
      };
    }
    if (data.action === "not-aus") {
      return {
        action: data.action,
        ...(await requestMiraGateway("not-aus", "POST", userId, {
          aktiv: data.active,
          grund: data.reason,
        })),
      };
    }
    if (data.action === "revoke") {
      return {
        action: data.action,
        ...(await requestMiraGateway("revoke", "POST", userId, {
          deviceId: data.deviceId,
          grund: data.reason,
        })),
      };
    }
    if (data.action === "screen") {
      return {
        action: data.action,
        ...(await requestMiraGateway("screen", "POST", userId, {
          deviceId: data.deviceId,
          aktiv: data.active,
        })),
      };
    }
    const result = await requestMiraGateway("action", "POST", userId, {
      deviceId: data.deviceId,
      toolId: data.toolId,
      args: data.args,
      confirmation: data.confirmation,
    });
    return { action: data.action, ...result };
  });
