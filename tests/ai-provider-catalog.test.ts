import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  DEFAULT_PROVIDERS,
  FREE_PROVIDER_CATALOG,
  enabledProviderSummary,
  isFreeOnlyProvider,
  loadProviders,
  saveProviders,
  selectProvider,
  toPayload,
} from "../src/lib/ai-providers.ts";
import { clearSensitiveClientStorage } from "../src/lib/sensitive-storage.ts";

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    get length() {
      return values.size;
    },
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, String(value));
    },
    removeItem(key: string) {
      values.delete(key);
    },
    key(index: number) {
      return [...values.keys()][index] ?? null;
    },
  } as unknown as Storage;
}

function withBrowserStorage<T>(localStorage: Storage, sessionStorage: Storage, run: () => T): T {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage, sessionStorage },
  });
  try {
    return run();
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
}

test("free provider catalog contains only OpenRouter's zero-cost free router", () => {
  assert.deepEqual(
    FREE_PROVIDER_CATALOG.map((entry) => entry.id),
    ["openrouter"],
  );
  assert.deepEqual(FREE_PROVIDER_CATALOG[0].models, ["openrouter/free"]);
  assert.equal(FREE_PROVIDER_CATALOG[0].supportsImages, false);
});

test("only OpenRouter Free can be enabled or selected", () => {
  for (const provider of DEFAULT_PROVIDERS) {
    if (provider.id !== "openrouter") {
      assert.equal(provider.enabled, false);
      assert.equal(isFreeOnlyProvider(provider.id), false);
    }
  }
  const configured = DEFAULT_PROVIDERS.map((provider) => ({
    ...provider,
    enabled: true,
    apiKey: "test-key",
  }));
  const selection = selectProvider(configured, "general");
  assert.equal(selection.provider?.id, "openrouter");
  assert.equal(selection.provider?.model, "openrouter/free");
  assert.equal(enabledProviderSummary(configured), "OpenRouter (Free Models)");
});

test("provider loading migrates old localStorage keys to sessionStorage and strips blocked providers", () => {
  const userKey = "super-ai-providers-v1:user-1";
  const legacy = DEFAULT_PROVIDERS.map((provider) => ({
    ...provider,
    enabled: true,
    apiKey: `legacy-${provider.id}`,
    model: provider.id === "openrouter" ? "some-paid-model" : provider.model,
  }));
  const local = memoryStorage({
    [userKey]: JSON.stringify(legacy),
    "super-ai-providers-v1": JSON.stringify([
      {
        id: "openrouter",
        enabled: true,
        apiKey: "belongs-to-previous-user",
        model: "openrouter/free",
      },
    ]),
  });
  const session = memoryStorage();

  withBrowserStorage(local, session, () => {
    const loaded = loadProviders("user-1");
    const openrouter = loaded.find((provider) => provider.id === "openrouter")!;
    const cerebras = loaded.find((provider) => provider.id === "cerebras")!;
    assert.equal(openrouter.enabled, true);
    assert.equal(openrouter.model, "openrouter/free");
    assert.equal(openrouter.apiKey, "legacy-openrouter");
    assert.equal(cerebras.enabled, false);
    assert.equal(cerebras.apiKey, "");
    assert.equal(local.getItem(userKey), null);
    assert.equal(local.getItem("super-ai-providers-v1"), null);
    assert.ok(session.getItem(userKey));
    assert.doesNotMatch(session.getItem(userKey)!, /belongs-to-previous-user/);

    saveProviders(
      loaded.map((provider) => ({ ...provider, enabled: true, apiKey: "attempted-key" })),
      "user-1",
    );
    const saved = JSON.parse(session.getItem(userKey)!) as typeof loaded;
    assert.equal(saved.find((provider) => provider.id === "openrouter")?.apiKey, "attempted-key");
    assert.equal(saved.find((provider) => provider.id === "cerebras")?.apiKey, "");
    assert.equal(saved.find((provider) => provider.id === "cerebras")?.enabled, false);
  });
});

test("logout cleanup clears sensitive keys from local and session storage", () => {
  const local = memoryStorage({
    "super-ai-providers-v1:user-1": "secret",
    "np-watch-snapshot:user-1": "snapshot",
    "keep-this": "safe",
  });
  const session = memoryStorage({
    "super-ai-providers-v1:user-1": "secret",
    "np-watch-snapshot:user-1": "snapshot",
    "keep-this-too": "safe",
  });
  withBrowserStorage(local, session, () => {
    clearSensitiveClientStorage();
    assert.equal(local.getItem("super-ai-providers-v1:user-1"), null);
    assert.equal(session.getItem("super-ai-providers-v1:user-1"), null);
    assert.equal(local.getItem("np-watch-snapshot:user-1"), null);
    assert.equal(session.getItem("np-watch-snapshot:user-1"), null);
    assert.equal(local.getItem("keep-this"), "safe");
    assert.equal(session.getItem("keep-this-too"), "safe");
  });
});

test("server rejects every provider except the fixed OpenRouter free router", () => {
  const server = readFileSync(new URL("../src/lib/super-ai.functions.ts", import.meta.url), "utf8");
  assert.match(server, /const OPENROUTER_MODEL = "openrouter\/free"/);
  assert.match(server, /max_tokens: 1200/);
  assert.match(server, /if \(p.id !== "openrouter"\)/);
  assert.match(server, /https:\/\/openrouter\.ai\/api\/v1\/chat\/completions/);
  assert.doesNotMatch(
    server,
    /callLovable|callAnthropic|callGoogle|assertSafeCustomBaseUrl|node:dns|node:net|baseUrl/,
  );
  assert.match(server, /Alo ist im Free-only-Modus/);
});

test("root auth listener clears sensitive browser storage when the signed-in account changes", () => {
  const root = readFileSync(new URL("../src/routes/__root.tsx", import.meta.url), "utf8");
  assert.match(root, /onAuthStateChange\(\(event, session\)/);
  assert.match(root, /event === "INITIAL_SESSION"/);
  assert.match(root, /currentUserId !== nextUserId/);
  assert.match(
    root,
    /if \(currentUserId && nextUserId && currentUserId !== nextUserId\) \{[\s\S]*?clearSensitiveClientStorage\(\)/,
  );
});

test("OpenRouter account metadata is not added to its payload", () => {
  const openrouter = DEFAULT_PROVIDERS.find((item) => item.id === "openrouter")!;
  assert.equal(toPayload(openrouter).accountId, undefined);
});
