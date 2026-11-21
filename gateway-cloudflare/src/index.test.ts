import { describe, expect, it } from "vitest";
import worker, { DeviceSession } from "./index";

describe("Mira Cloudflare gateway", () => {
  it("exposes a no-store health endpoint", async () => {
    const response = await worker.fetch(new Request("https://example.test/healthz"), { DEVICE_SESSIONS: {} as DurableObjectNamespace<DeviceSession>, MIRA_GATEWAY_ADMIN_TOKEN: "unused" });
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ ok: true, phase: "pairing-preview" });
  });
  it("rejects device WebSockets until protocol parity exists", async () => {
    const response = await worker.fetch(new Request("https://example.test/v1/ws"), { DEVICE_SESSIONS: { idFromName: () => "global", get: () => ({ fetch: async () => Response.json({ error: "websocket-not-enabled" }, { status: 503 }) }) } as unknown as DurableObjectNamespace<DeviceSession>, MIRA_GATEWAY_ADMIN_TOKEN: "unused" });
    expect(response.status).toBe(503);
  });
});
