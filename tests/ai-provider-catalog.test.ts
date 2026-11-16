import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_PROVIDERS, FREE_PROVIDER_CATALOG, toPayload } from "../src/lib/ai-providers.ts";

test("free API provider catalog contains only the four explicitly supported integrations", () => {
  assert.deepEqual(FREE_PROVIDER_CATALOG.map((entry) => entry.id), [
    "openrouter", "cerebras", "cloudflare",
  ]);
  assert.ok(FREE_PROVIDER_CATALOG.every((entry) => entry.models.length > 0));
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
