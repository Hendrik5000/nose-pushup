import assert from "node:assert/strict";
import { describe, it } from "node:test";
import worker from "./index.ts";

describe("Mira Cloudflare gateway", () => {
  it("exposes a no-store health endpoint", async () => {
    const response = await worker.fetch(new Request("https://example.test/healthz"), {
      DEVICE_SESSIONS: {
        idFromName: () => "global",
        get: () => ({ fetch: async () => new Response("unused") }),
      },
      MIRA_GATEWAY_ADMIN_TOKEN: "unused",
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    const body = (await response.json()) as { ok: boolean; phase: string };
    assert.equal(body.ok, true);
    assert.equal(body.phase, "pairing-preview");
  });

  it("forwards versioned API requests to the Durable Object", async () => {
    let receivedPath = "";
    const response = await worker.fetch(new Request("https://example.test/v1/ws"), {
      DEVICE_SESSIONS: {
        idFromName: () => "global",
        get: () => ({
          fetch: async (request) => {
            receivedPath = new URL(request.url).pathname;
            return Response.json({ error: "websocket-upgrade-erforderlich" }, { status: 426 });
          },
        }),
      },
      MIRA_GATEWAY_ADMIN_TOKEN: "unused",
    });
    assert.equal(receivedPath, "/v1/ws");
    assert.equal(response.status, 426);
  });

  it("does not expose non-versioned internal routes", async () => {
    const response = await worker.fetch(new Request("https://example.test/internal"), {
      DEVICE_SESSIONS: {
        idFromName: () => "global",
        get: () => ({ fetch: async () => new Response("unexpected") }),
      },
      MIRA_GATEWAY_ADMIN_TOKEN: "unused",
    });
    assert.equal(response.status, 404);
  });
});
