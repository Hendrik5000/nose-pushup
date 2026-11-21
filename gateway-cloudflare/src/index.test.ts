import { describe, expect, it } from "vitest";
import worker, { DeviceSession } from "./index";

describe("Mira Cloudflare gateway scaffold", () => {
  it("exposes a no-store health endpoint", async () => {
    const response = await worker.fetch(new Request("https://example.test/healthz"), { DEVICE_SESSIONS: {} as DurableObjectNamespace<DeviceSession>, MIRA_GATEWAY_ADMIN_TOKEN: "unused" });
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ ok: true, phase: "scaffold" });
  });

  it("keeps device and control routes closed until parity is implemented", async () => {
    const env = { DEVICE_SESSIONS: {} as DurableObjectNamespace<DeviceSession>, MIRA_GATEWAY_ADMIN_TOKEN: "unused" };
    for (const path of ["/v1/pair", "/v1/ws", "/v1/control/devices"]) {
      const response = await worker.fetch(new Request("https://example.test" + path), env);
      expect(response.status).toBe(503);
    }
  });
});
