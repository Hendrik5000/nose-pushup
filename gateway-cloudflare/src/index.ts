export interface Env {
  DEVICE_SESSIONS: DurableObjectNamespace<DeviceSession>;
  MIRA_GATEWAY_ADMIN_TOKEN: string;
  MIRA_GATEWAY_PAIRING_TTL_MS?: string;
  MIRA_GATEWAY_HEARTBEAT_TIMEOUT_MS?: string;
}

const json = (body: unknown, status = 200): Response =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/healthz") {
      return json({ ok: true, service: "mira-device-control-gateway", runtime: "cloudflare-workers", phase: "scaffold" });
    }

    // The public routes remain closed until their protocol-compatible handlers
    // are ported and covered by tests. Never accept unauthenticated device traffic.
    if (["/v1/pair", "/v1/ws"].includes(url.pathname) || url.pathname.startsWith("/v1/control/")) {
      return json({ error: "gateway-port-in-progress", message: "This Cloudflare gateway is not enabled for device traffic yet." }, 503);
    }

    return json({ error: "not-found" }, 404);
  },
};

export class DeviceSession {
  private readonly state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/internal/health") {
      const stored = await this.state.storage.get<number>("schemaVersion");
      return Response.json({ ok: true, schemaVersion: stored ?? 0 });
    }
    return Response.json({ error: "not-found" }, { status: 404 });
  }
}
