import assert from "node:assert/strict";
import { describe, it } from "node:test";
import worker from "./index.ts";

describe("Mira Cloudflare gateway", () => {
  it("exposes a no-store health endpoint", async () => {
    const response = await worker.fetch(new Request("https://example.test/healthz"), {
      DEVICE_SESSIONS: {
        idFromName: () => "global",
        get: async () => ({ fetch: async () => new Response("unused") }),
      },
      MIRA_GATEWAY_ADMIN_TOKEN: "unused",
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    const body = (await response.json()) as { ok: boolean; phase: string };
    assert.equal(body.ok, true);
    assert.equal(body.phase, "pairing-preview");
  });
  it("rejects device WebSockets until protocol parity exists", async () => {
    const response = await worker.fetch(new Request("https://example.test/v1/ws"), {
      DEVICE_SESSIONS: {
        idFromName: () => "global",
        get: async () => ({
          fetch: async () => Response.json({ error: "websocket-not-enabled" }, { status: 503 }),
        }),
      },
      MIRA_GATEWAY_ADMIN_TOKEN: "unused",
    });
    assert.equal(response.status, 503);
  });
});
