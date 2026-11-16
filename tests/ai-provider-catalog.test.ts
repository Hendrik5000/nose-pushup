import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { DEFAULT_PROVIDERS, FREE_PROVIDER_CATALOG, toPayload } from "../src/lib/ai-providers.ts";

test("free API provider catalog contains only the four explicitly supported integrations", () => {
  assert.deepEqual(
    FREE_PROVIDER_CATALOG.map((entry) => entry.id),
    ["openrouter", "cerebras", "cloudflare"],
  );
  assert.ok(FREE_PROVIDER_CATALOG.every((entry) => entry.models.length > 0));
  const cloudflare = FREE_PROVIDER_CATALOG.find((entry) => entry.id === "cloudflare")!;
  assert.ok(cloudflare.models.includes("@cf/qwen/qwen3.8-27b"));
  assert.ok(!cloudflare.models.includes("@cf/nvidia/nemotron-3-120b-a12b"));
  assert.ok(FREE_PROVIDER_CATALOG.every((entry) => entry.supportsImages === false));
});

test("new API providers are disabled by default and never trigger a paid fallback", () => {
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
  const server = readFileSync(new URL("../src/lib/super-ai.functions.ts", import.meta.url), "utf8");
  assert.match(server, /openrouter:\s*\["openrouter\/free"\]/);
  assert.match(server, /cerebras:\s*\["gpt-oss-120b"\]/);
  assert.match(server, /https:\/\/openrouter\.ai\/api\/v1/);
  assert.match(server, /https:\/\/api\.cerebras\.ai\/v1/);
  assert.match(server, /https:\/\/api\.cloudflare\.com\/client\/v4\/accounts/);
  assert.match(server, /\^\[a-f0-9\]\{32\}\$/);
});

test("text-only free providers reject image attachments before forwarding", () => {
  const server = readFileSync(new URL("../src/lib/super-ai.functions.ts", import.meta.url), "utf8");
  assert.match(server, /attachments\.some\(\(item\) => item\.mime\.startsWith\("image\/"\)\)/);
  assert.match(server, /Es wurde kein Bild gesendet/);
});
