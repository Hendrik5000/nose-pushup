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
  permissions: Record<string, string>;
};
type LogEntry = { at: string; kind: string; deviceId?: string; status?: string };

interface GatewayDeviceSessions {
  idFromName(name: string): unknown;
  get(id: unknown): Promise<{ fetch(request: Request): Promise<Response> }>;
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
  bytesToHex(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))),
  );
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
  status: "keine",
  programme: "keine",
  fenster: "keine",
  eingaben: "keine",
  bildschirm: "keine",
  dateien: "keine",
  einstellungen: "keine",
  audio: "keine",
});
const sanitizeDevice = (d: DeviceRecord) => ({
  deviceId: d.deviceId,
  name: d.name,
  platform: d.platform,
  publicKeySpki: d.publicKeySpki,
  fingerprint: d.fingerprint,
  agentVersion: d.agentVersion,
  createdAt: d.createdAt,
  revokedAt: d.revokedAt,
  permissions: d.permissions,
});

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/healthz") {
      return json({
        ok: true,
        service: "mira-device-control-gateway",
        runtime: "cloudflare-workers",
        phase: "pairing-preview",
      });
    }
    if (!url.pathname.startsWith("/v1/")) return json({ error: "not-found" }, 404);
    const id = env.DEVICE_SESSIONS.idFromName("mira-gateway-global-v1");
    const stub = await env.DEVICE_SESSIONS.get(id);
    return stub.fetch(request);
  },
};

export class DeviceSession {
  private readonly state: DurableObjectState;
  private readonly env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/v1/pair") return this.pair(request);
    if (url.pathname.startsWith("/v1/control/")) return this.control(request, url);
    // Device WebSocket protocol is intentionally disabled until handshake,
    // token-authentication and hibernation tests are implemented.
    if (url.pathname === "/v1/ws") return json({ error: "websocket-not-enabled" }, 503);
    return json({ error: "not-found" }, 404);
  }

  private async authorized(request: Request): Promise<boolean> {
    const expected = this.env.MIRA_GATEWAY_ADMIN_TOKEN ?? "";
    const header = request.headers.get("Authorization") ?? "";
    const provided = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    return expected.length >= 32 && timingSafeEqual(provided, expected);
  }

  private async pair(request: Request): Promise<Response> {
    const body = await readBody(request);
    if (
      !body ||
      typeof body.code !== "string" ||
      !/^[0-9]{6}$/.test(body.code) ||
      typeof body.deviceName !== "string" ||
      body.deviceName.trim().length < 1 ||
      body.deviceName.trim().length > 100 ||
      typeof body.platform !== "string" ||
      !["windows", "android", "ipad"].includes(body.platform) ||
      typeof body.publicKeySpki !== "string" ||
      body.publicKeySpki.length < 200 ||
      body.publicKeySpki.length > 4000 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(body.publicKeySpki) ||
      typeof body.agentVersion !== "string" ||
      body.agentVersion.length < 1 ||
      body.agentVersion.length > 50
    ) {
      return json({ error: "ungueltige-anfrage" }, 400);
    }

    const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
    const now = Date.now();
    const rateKey = "pair-failures:" + ip;
    const stored = await this.state.storage.get<number[]>(rateKey);
    const failures = (stored ?? []).filter((t) => now - t < 600_000);
    if (failures.length >= 5) return json({ error: "zu-viele-versuche" }, 429);

    let publicKeyBytes: Uint8Array;
    try {
      const binary = atob(body.publicKeySpki);
      publicKeyBytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
      if (btoa(binary) !== body.publicKeySpki)
        return json({ error: "ungueltiger-schluessel" }, 400);
      await crypto.subtle.importKey(
        "spki",
        publicKeyBytes,
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["verify"],
      );
    } catch {
      return json({ error: "ungueltiger-schluessel" }, 400);
    }

    const pairing = await this.state.storage.get<PairingRecord>("pairing:" + body.code);
    if (!pairing || pairing.usedAt !== null || pairing.expiresAt <= now) {
      if (pairing) await this.state.storage.delete("pairing:" + body.code);
      failures.push(now);
      await this.state.storage.put(rateKey, failures);
      return json({ error: "kopplungscode-ungueltig" }, 401);
    }
    pairing.usedAt = now;
    await this.state.storage.put("pairing:" + body.code, pairing);

    const deviceId = crypto.randomUUID();
    const token = randomToken();
    const salt = randomHex(16);
    const tokenHash = await sha256(salt + ":" + token);
    const fingerprint = (await sha256(body.publicKeySpki)).slice(0, 16);
    const device: DeviceRecord = {
      deviceId,
      ownerUserId: pairing.ownerUserId,
      name: body.deviceName.trim(),
      platform: body.platform,
      publicKeySpki: body.publicKeySpki,
      fingerprint,
      agentVersion: body.agentVersion,
      tokenHash,
      tokenSalt: salt,
      createdAt: new Date(now).toISOString(),
      revokedAt: null,
      permissions: defaultPermissions(),
    };
    await this.state.storage.put("device:" + deviceId, device);
    await this.appendLog({ kind: "kopplung", deviceId, status: "gekoppelt" });
    await this.state.storage.delete(rateKey);
    return json({ deviceId, deviceToken: token, fingerprint });
  }

  private async control(request: Request, url: URL): Promise<Response> {
    if (!(await this.authorized(request))) return json({ error: "unauthorisiert" }, 401);
    const route = url.pathname.slice("/v1/control/".length);
    if (route === "pairing-code" && request.method === "POST") {
      const body = await readBody(request);
      if (!body || !validUserId(body.userId)) return json({ error: "ungueltige-anfrage" }, 400);
      const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(
        6,
        "0",
      );
      const ttl = Math.min(
        Math.max(Number(this.env.MIRA_GATEWAY_PAIRING_TTL_MS ?? 300000), 10000),
        300000,
      );
      const now = Date.now();
      const record: PairingRecord = {
        code,
        ownerUserId: body.userId,
        createdAt: now,
        expiresAt: now + ttl,
        usedAt: null,
      };
      await this.state.storage.put("pairing:" + code, record);
      await this.appendLog({ kind: "kopplung", status: "code-erzeugt" });
      return json({ code, expiresAt: new Date(record.expiresAt).toISOString() });
    }
    if (route === "devices" && request.method === "GET") {
      const userId = url.searchParams.get("userId");
      if (!validUserId(userId)) return json({ error: "ungueltige-anfrage" }, 400);
      const all = await this.state.storage.list<DeviceRecord>({ prefix: "device:" });
      return json({
        devices: Array.from(all.values())
          .filter((d) => d.ownerUserId === userId)
          .map(sanitizeDevice),
      });
    }
    return json({ error: "control-route-not-yet-ported" }, 503);
  }

  private async appendLog(entry: Omit<LogEntry, "at">): Promise<void> {
    const stored = await this.state.storage.get<LogEntry[]>("actionLog");
    const entries = stored ?? [];
    entries.push({ at: new Date().toISOString(), ...entry });
    await this.state.storage.put("actionLog", entries.slice(-1000));
  }
}
