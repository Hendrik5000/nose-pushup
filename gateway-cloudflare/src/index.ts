/* eslint-disable prettier/prettier -- keep the gateway source formatting stable until the isolated package has a formatter step. */
import { DurableObject } from "cloudflare:workers";

export interface Env {
  DEVICE_SESSIONS: GatewayDeviceSessions;
  MIRA_GATEWAY_ADMIN_TOKEN: string;
  MIRA_GATEWAY_PAIRING_TTL_MS?: string;
  MIRA_GATEWAY_HEARTBEAT_TIMEOUT_MS?: string;
}

type PairingRecord = {
  code: string;
  ownerUserId: string;
  createdAt: number;
  expiresAt: number;
  usedAt: number | null;
};
type DeviceRecord = {
  deviceId: string;
  ownerUserId: string;
  name: string;
  platform: string;
  publicKeySpki: string;
  fingerprint: string;
  agentVersion: string;
  tokenHash: string;
  tokenSalt: string;
  createdAt: string;
  revokedAt: string | null;
  lastSeenAt: number | null;
  permissions: Record<string, string>;
};
type LogEntry = { at: string; kind: string; deviceId?: string; status?: string };

interface GatewayDeviceSessions {
  idFromName(name: string): unknown;
  get(id: unknown): { fetch(request: Request): Promise<Response> };
}

const json = (body: unknown, status = 200): Response =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const validUserId = (v: unknown): v is string =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
const randomHex = (length: number): string => {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
};
const randomToken = (): string => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const sha256 = async (value: string): Promise<string> =>
  bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))));
const timingSafeEqual = (a: string, b: string): boolean => {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
  return diff === 0;
};
const readBody = async (
  request: Request,
  maxBytes = 64 * 1024,
): Promise<Record<string, unknown> | null> => {
  const text = await request.text();
  if (new TextEncoder().encode(text).length > maxBytes) return null;
  try {
    const value: unknown = JSON.parse(text);
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
};
const defaultPermissions = (): Record<string, string> => ({
  status: "keine", programme: "keine", fenster: "keine", eingaben: "keine",
  bildschirm: "keine", dateien: "keine", einstellungen: "keine", audio: "keine",
});
const sanitizeDevice = (d: DeviceRecord) => ({
  deviceId: d.deviceId, name: d.name, platform: d.platform, publicKeySpki: d.publicKeySpki,
  fingerprint: d.fingerprint, agentVersion: d.agentVersion, createdAt: d.createdAt,
  revokedAt: d.revokedAt, permissions: d.permissions,
});

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/healthz") {
      return json({ ok: true, service: "mira-device-control-gateway", runtime: "cloudflare-workers", phase: "pairing-preview" });
    }
    if (!url.pathname.startsWith("/v1/")) return json({ error: "not-found" }, 404);
    const id = env.DEVICE_SESSIONS.idFromName("mira-gateway-global-v1");
    const stub = env.DEVICE_SESSIONS.get(id);
    return stub.fetch(request);
  },
};

export class DeviceSession extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/v1/pair") return this.pair(request);
    if (url.pathname.startsWith("/v1/control/")) return this.control(request, url);
    if (url.pathname === "/v1/ws") return this.connectDevice(request);
    return json({ error: "not-found" }, 404);
  }

  private async connectDevice(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return json({ error: "websocket-upgrade-erforderlich" }, 426);
    }
    const deviceId = request.headers.get("X-Mira-Device") ?? "";
    const authorization = request.headers.get("Authorization") ?? "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
    if (!deviceId || deviceId.length > 80 || token.length < 32 || token.length > 256) {
      return json({ error: "unauthorisiert" }, 401);
    }
    const device = await this.ctx.storage.get<DeviceRecord>("device:" + deviceId);
    if (!device || device.revokedAt !== null) return json({ error: "geraet-unbekannt" }, 401);
    const stoppedOwners = (await this.ctx.storage.get<string[]>("emergencyStopOwners")) ?? [];
    if (stoppedOwners.includes(device.ownerUserId)) return json({ error: "not-aus-aktiv", retryable: false }, 423);
    const suppliedHash = await sha256(device.tokenSalt + ":" + token);
    if (!timingSafeEqual(suppliedHash, device.tokenHash)) return json({ error: "unauthorisiert" }, 401);

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.ctx.acceptWebSocket(server, [deviceId]);
    server.serializeAttachment({ deviceId, authenticated: false });
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const attachment = socket.deserializeAttachment() as { deviceId?: string; authenticated?: boolean } | null;
    const deviceId = attachment?.deviceId ?? "";
    if (!deviceId) { socket.close(1008, "geraet-unbekannt"); return; }
    const raw = typeof message === "string"
      ? message
      : new TextDecoder().decode(message instanceof ArrayBuffer ? message : new Uint8Array(message));
    if (raw.length > 2_000_000) { socket.close(1009, "nachricht-zu-gross"); return; }
    let envelope: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("invalid");
      envelope = parsed as Record<string, unknown>;
    } catch {
      await this.appendLog({ kind: "ablehnung", deviceId, status: "ungueltiger-umschlag" });
      socket.close(1008, "ungueltiger-umschlag");
      return;
    }
    if (envelope.version !== 1 || typeof envelope.id !== "string" || envelope.id.length < 1 || envelope.id.length > 64 ||
      typeof envelope.type !== "string" || envelope.type.length < 1 || envelope.type.length > 64 ||
      typeof envelope.at !== "string" || envelope.at.length > 64 ||
      (envelope.payloadJson !== undefined && typeof envelope.payloadJson !== "string")) {
      socket.close(1008, "ungueltiger-umschlag");
      return;
    }
    const device = await this.ctx.storage.get<DeviceRecord>("device:" + deviceId);
    if (!device || device.revokedAt !== null) { socket.close(4403, "widerrufen"); return; }

    if (attachment?.authenticated !== true) {
      if (envelope.type !== "hello" || typeof envelope.payloadJson !== "string") {
        socket.close(1008, "hello-erwartet");
        return;
      }
      let hello: unknown;
      try { hello = JSON.parse(envelope.payloadJson); } catch { socket.close(1008, "hello-ungueltig"); return; }
      if (typeof hello !== "object" || hello === null || Array.isArray(hello)) { socket.close(1008, "hello-ungueltig"); return; }
      const value = hello as Record<string, unknown>;
      if (value.deviceId !== deviceId || value.platform !== device.platform ||
        typeof value.agentVersion !== "string" || value.agentVersion.length < 1 || value.agentVersion.length > 50 ||
        Object.keys(value).some((key) => !["deviceId", "platform", "agentVersion"].includes(key))) {
        socket.close(1008, "hello-ungueltig");
        return;
      }
      socket.serializeAttachment({ deviceId, authenticated: true });
      device.lastSeenAt = Date.now();
      await this.ctx.storage.put("device:" + deviceId, device);
      await this.appendLog({ kind: "verbindung", deviceId, status: "aufgebaut" });
      socket.send(JSON.stringify(this.envelope("welcome", {
        permissions: device.permissions,
        toolAllowlist: [],
        screenSessionRequired: true,
        heartbeatTimeoutSeconds: Math.round(Number(this.env.MIRA_GATEWAY_HEARTBEAT_TIMEOUT_MS ?? 90000) / 1000),
      })));
      return;
    }

    if (envelope.type === "heartbeat") {
      device.lastSeenAt = Date.now();
      await this.ctx.storage.put("device:" + deviceId, device);
      socket.send(JSON.stringify(this.envelope("heartbeat", { serverTime: new Date().toISOString() })));
      return;
    }
    if (envelope.type === "action.result") {
      await this.appendLog({ kind: "aktion", deviceId, status: "ergebnis-empfangen" });
      return;
    }
    await this.appendLog({ kind: "ablehnung", deviceId, status: "typ-unbekannt" });
  }

  async webSocketClose(socket: WebSocket, code: number, reason: string): Promise<void> {
    const attachment = socket.deserializeAttachment() as { deviceId?: string } | null;
    if (attachment?.deviceId) {
      const device = await this.ctx.storage.get<DeviceRecord>("device:" + attachment.deviceId);
      if (device) { device.lastSeenAt = null; await this.ctx.storage.put("device:" + attachment.deviceId, device); }
      await this.appendLog({ kind: "verbindung", deviceId: attachment.deviceId, status: "getrennt" });
    }
  }

  async webSocketError(socket: WebSocket): Promise<void> {
    const attachment = socket.deserializeAttachment() as { deviceId?: string } | null;
    if (attachment?.deviceId) {
      const device = await this.ctx.storage.get<DeviceRecord>("device:" + attachment.deviceId);
      if (device) { device.lastSeenAt = null; await this.ctx.storage.put("device:" + attachment.deviceId, device); }
      await this.appendLog({ kind: "verbindung", deviceId: attachment.deviceId, status: "fehler" });
    }
  }

  private envelope(type: string, payload?: unknown): Record<string, unknown> {
    const result: Record<string, unknown> = {
      version: 1,
      id: crypto.randomUUID(),
      type,
      at: new Date().toISOString(),
    };
    if (payload !== undefined) result.payloadJson = JSON.stringify(payload);
    return result;
  }

  private async authorized(request: Request): Promise<boolean> {
    const expected = this.env.MIRA_GATEWAY_ADMIN_TOKEN ?? "";
    const header = request.headers.get("Authorization") ?? "";
    const provided = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    return expected.length >= 32 && timingSafeEqual(provided, expected);
  }

  private async pair(request: Request): Promise<Response> {
    const body = await readBody(request);
    if (!body || typeof body.code !== "string" || !/^[0-9]{6}$/.test(body.code) ||
      typeof body.deviceName !== "string" || body.deviceName.trim().length < 1 || body.deviceName.trim().length > 100 ||
      typeof body.platform !== "string" || !["windows", "android", "ipad"].includes(body.platform) ||
      typeof body.publicKeySpki !== "string" || body.publicKeySpki.length < 200 || body.publicKeySpki.length > 4000 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(body.publicKeySpki) || typeof body.agentVersion !== "string" ||
      body.agentVersion.length < 1 || body.agentVersion.length > 50) return json({ error: "ungueltige-anfrage" }, 400);

    const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
    const now = Date.now();
    const rateKey = "pair-failures:" + ip;
    const stored = await this.ctx.storage.get<number[]>(rateKey);
    const failures = (stored ?? []).filter((t) => now - t < 600_000);
    if (failures.length >= 5) return json({ error: "zu-viele-versuche" }, 429);

    try {
      const binary = atob(body.publicKeySpki);
      const publicKeyBytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
      if (btoa(binary) !== body.publicKeySpki) return json({ error: "ungueltiger-schluessel" }, 400);
      const publicKey = await crypto.subtle.importKey("spki", publicKeyBytes, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
      if (publicKey.algorithm.name !== "RSASSA-PKCS1-v1_5" || ("modulusLength" in publicKey.algorithm && publicKey.algorithm.modulusLength < 2048))
        return json({ error: "ungueltiger-schluessel" }, 400);
    } catch {
      return json({ error: "ungueltiger-schluessel" }, 400);
    }

    const pairing = await this.ctx.storage.get<PairingRecord>("pairing:" + body.code);
    if (!pairing || pairing.usedAt !== null || pairing.expiresAt <= now) {
      if (pairing) await this.ctx.storage.delete("pairing:" + body.code);
      failures.push(now);
      await this.ctx.storage.put(rateKey, failures);
      return json({ error: "kopplungscode-ungueltig" }, 401);
    }
    pairing.usedAt = now;
    await this.ctx.storage.put("pairing:" + body.code, pairing);

    const deviceId = crypto.randomUUID();
    const token = randomToken();
    const salt = randomHex(16);
    const tokenHash = await sha256(salt + ":" + token);
    const fingerprint = (await sha256(body.publicKeySpki)).slice(0, 16);
    const device: DeviceRecord = {
      deviceId, ownerUserId: pairing.ownerUserId, name: body.deviceName.trim(), platform: body.platform,
      publicKeySpki: body.publicKeySpki, fingerprint, agentVersion: body.agentVersion,
      tokenHash, tokenSalt: salt, createdAt: new Date(now).toISOString(), revokedAt: null, lastSeenAt: null,
      permissions: defaultPermissions(),
    };
    await this.ctx.storage.put("device:" + deviceId, device);
    await this.appendLog({ kind: "kopplung", deviceId, status: "gekoppelt" });
    await this.ctx.storage.delete(rateKey);
    return json({ deviceId, deviceToken: token, fingerprint });
  }

  private async control(request: Request, url: URL): Promise<Response> {
    if (!(await this.authorized(request))) return json({ error: "unauthorisiert" }, 401);
    const route = url.pathname.slice("/v1/control/".length);
    if (route === "pairing-code" && request.method === "POST") {
      const body = await readBody(request);
      if (!body || !validUserId(body.userId)) return json({ error: "ungueltige-anfrage" }, 400);
      const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
      const ttl = Math.min(Math.max(Number(this.env.MIRA_GATEWAY_PAIRING_TTL_MS ?? 300000), 10000), 300000);
      const now = Date.now();
      const record: PairingRecord = { code, ownerUserId: body.userId, createdAt: now, expiresAt: now + ttl, usedAt: null };
      await this.ctx.storage.put("pairing:" + code, record);
      await this.appendLog({ kind: "kopplung", status: "code-erzeugt" });
      return json({ code, expiresAt: new Date(record.expiresAt).toISOString() });
    }
    if (route === "devices" && request.method === "GET") {
      const userId = url.searchParams.get("userId");
      if (!validUserId(userId)) return json({ error: "ungueltige-anfrage" }, 400);
      const all = await this.ctx.storage.list<DeviceRecord>({ prefix: "device:" });
      const timeout = Math.min(Math.max(Number(this.env.MIRA_GATEWAY_HEARTBEAT_TIMEOUT_MS ?? 90000), 30000), 300000);
      const now = Date.now();
      return json({ devices: Array.from(all.values()).filter((d) => d.ownerUserId === userId).map((d) => ({ ...sanitizeDevice(d), online: d.revokedAt === null && d.lastSeenAt !== null && now - d.lastSeenAt <= timeout })) });
    }
    if (route === "action-log" && request.method === "GET") {
      const userId = url.searchParams.get("userId");
      if (!validUserId(userId)) return json({ error: "ungueltige-anfrage" }, 400);
      const limitValue = Number.parseInt(url.searchParams.get("limit") ?? "100", 10);
      const limit = Math.min(Math.max(Number.isFinite(limitValue) ? limitValue : 100, 1), 1000);
      const entries = (await this.ctx.storage.get<LogEntry[]>("actionLog")) ?? [];
      const devices = await this.ctx.storage.list<DeviceRecord>({ prefix: "device:" });
      const owned = new Set(Array.from(devices.values()).filter((d) => d.ownerUserId === userId).map((d) => d.deviceId));
      return json({ entries: entries.filter((entry) => entry.deviceId && owned.has(entry.deviceId)).slice(-limit) });
    }
    if (route === "not-aus" && request.method === "GET") {
      const userId = url.searchParams.get("userId");
      if (!validUserId(userId)) return json({ error: "ungueltige-anfrage" }, 400);
      const owners = (await this.ctx.storage.get<string[]>("emergencyStopOwners")) ?? [];
      return json({ aktiv: owners.includes(userId) });
    }
    if (request.method !== "POST") return json({ error: "methode-nicht-erlaubt" }, 405);
    const body = await readBody(request);
    if (!body || !validUserId(body.userId)) return json({ error: "ungueltige-anfrage" }, 400);
    const userId = body.userId;
    if (route === "permissions") {
      const deviceId = typeof body.deviceId === "string" ? body.deviceId : "";
      const permissions = body.permissions;
      const keys = ["status", "programme", "fenster", "eingaben", "bildschirm", "dateien", "einstellungen", "audio"];
      const levels = ["keine", "lesen", "steuern", "kritisch"];
      if (!deviceId || typeof permissions !== "object" || permissions === null || Array.isArray(permissions)) return json({ error: "ungueltige-anfrage" }, 400);
      const map = permissions as Record<string, unknown>;
      if (Object.keys(map).length !== keys.length || keys.some((key) => !levels.includes(String(map[key])))) return json({ error: "ungueltige-anfrage" }, 400);
      const device = await this.ctx.storage.get<DeviceRecord>("device:" + deviceId);
      if (!device || device.ownerUserId !== userId || device.revokedAt !== null) return json({ error: "geraet-unbekannt" }, 404);
      device.permissions = Object.fromEntries(keys.map((key) => [key, String(map[key])]));
      await this.ctx.storage.put("device:" + deviceId, device);
      await this.appendLog({ kind: "sitzung", deviceId, status: "berechtigungen-aktualisiert" });
      return json({ ok: true, fingerprint: device.fingerprint });
    }
    if (route === "revoke") {
      const deviceId = typeof body.deviceId === "string" ? body.deviceId : "";
      if (!deviceId) return json({ error: "ungueltige-anfrage" }, 400);
      const device = await this.ctx.storage.get<DeviceRecord>("device:" + deviceId);
      if (!device || device.ownerUserId !== userId) return json({ error: "geraet-unbekannt" }, 404);
      if (device.revokedAt === null) {
        device.revokedAt = new Date().toISOString();
        device.lastSeenAt = null;
        await this.ctx.storage.put("device:" + deviceId, device);
        for (const socket of this.ctx.getWebSockets(deviceId)) {
          try { socket.send(JSON.stringify(this.envelope("revoke", { reason: "widerrufen" }))); } catch { /* socket may already be closed */ }
          try { socket.close(4403, "widerrufen"); } catch { /* socket may already be closed */ }
        }
        await this.appendLog({ kind: "widerruf", deviceId, status: "widerrufen" });
      }
      return json({ ok: true });
    }
    if (route === "not-aus") {
      const owners = new Set((await this.ctx.storage.get<string[]>("emergencyStopOwners")) ?? []);
      const active = body.aktiv === true;
      if (active) owners.add(userId); else owners.delete(userId);
      await this.ctx.storage.put("emergencyStopOwners", Array.from(owners));
      if (active) {
        for (const socket of this.ctx.getWebSockets()) {
          const attachment = socket.deserializeAttachment() as { deviceId?: string } | null;
          if (!attachment?.deviceId) continue;
          try { socket.send(JSON.stringify(this.envelope("not-aus", { reason: "vom-benutzer-aktiviert" }))); } catch { /* socket may already be closed */ }
          try { socket.close(4001, "not-aus"); } catch { /* socket may already be closed */ }
          const device = await this.ctx.storage.get<DeviceRecord>("device:" + attachment.deviceId);
          if (device) { device.lastSeenAt = null; await this.ctx.storage.put("device:" + attachment.deviceId, device); }
        }
      }
      await this.appendLog({ kind: "not-aus", status: active ? "aktiviert" : "deaktiviert" });
      return json({ ok: true, aktiv: active });
    }
    if (route === "action" || route === "screen" || route === "screen-frame") {
      return json({ error: "geraet-offline", feature: route }, 503);
    }
    return json({ error: "control-route-not-yet-ported" }, 503);
  }

  private async appendLog(entry: Omit<LogEntry, "at">): Promise<void> {
    const stored = await this.ctx.storage.get<LogEntry[]>("actionLog");
    const entries = stored ?? [];
    entries.push({ at: new Date().toISOString(), ...entry });
    await this.ctx.storage.put("actionLog", entries.slice(-1000));
  }
}
