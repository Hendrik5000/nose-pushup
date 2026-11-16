import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { DEFAULT_PROVIDERS, FREE_PROVIDER_CATALOG, toPayload } from "../src/lib/ai-providers.ts";

test("free API provider catalog contains only the three explicitly supported integrations", () => {
  assert.deepEqual(FREE_PROVIDER_CATALOG.map((entry) => entry.id), [
    "openrouter", "cerebras", "cloudflare",
  ]);
  assert.ok(FREE_PROVIDER_CATALOG.every((entry) => entry.models.length > 0));
  assert.ok(FREE_PROVIDER_CATALOG.every((entry) => entry.supportsImages === false));
});

test("new API providers start disabled and require the user’s own API key", () => {
  for (const id of ["openrouter", "cerebras", "cloudflare"] as const) {
    const provider = DEFAULT_PROVIDERS.find((item) => item.id === id);
    assert.ok(provider);
    assert.equal(provider.enabled, false);
    assert.equal(provider.apiKey, "");
  }
});

test("Cloudflare account ID is included only for the Cloudflare provider", () => {
  const cloudflare = DEFAULT_PROVIDERS.find((item) => item.id === "cloudflare")!;
  cloudflare.accountId = "0123456789abcdef0123456789abcdef";
  assert.equal(toPayload(cloudflare).accountId, cloudflare.accountId);
  const openrouter = DEFAULT_PROVIDERS.find((item) => item.id === "openrouter")!;
  assert.equal(toPayload(openrouter).accountId, undefined);
});


test("server pins provider endpoints and model IDs instead of accepting arbitrary URLs", () => {
  const server = readFileSync(
    new URL("../src/lib/super-ai.functions.ts", import.meta.url),
    "utf8",
  );
  assert.ok(server.includes('openrouter: ["openrouter/free"]'));
  assert.ok(server.includes('cerebras: ["gpt-oss-120b"]'));
  assert.ok(server.includes('"https://openrouter.ai/api/v1"'));
  assert.ok(server.includes('"https://api.cerebras.ai/v1"'));
  assert.ok(server.includes('https://api.cloudflare.com/client/v4/accounts/${p.accountId}/ai/v1'));
  assert.ok(server.includes('!/^[a-f0-9]{32}$/i.test(p.accountId)'));
});

test("text-only free providers reject image attachments before forwarding", () => {
  const server = readFileSync(
    new URL("../src/lib/super-ai.functions.ts", import.meta.url),
    "utf8",
  );
  assert.ok(server.includes('attachments.some((item) => item.mime.startsWith("image/"))'));
  assert.ok(server.includes("Es wurde kein Bild gesendet"));
});
