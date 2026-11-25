import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  DEFAULT_PROVIDERS,
  SUPPORTED_PROVIDER_CATALOG,
  classifyTask,
  enabledProviderSummary,
  isProviderReady,
  isSupportedProvider,
  loadProviders,
  saveProviders,
  selectProvider,
  toPayload,
} from "../src/lib/ai-providers.ts";
import { clearSensitiveClientStorage } from "../src/lib/sensitive-storage.ts";
import { clearProviderMemory } from "../src/lib/ai-provider-memory.ts";
import { resolveGeminiModelForTask } from "../src/lib/gemini-models.ts";

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

test("only Google Gemini and OpenRouter Free are in the supported provider catalog", () => {
  assert.deepEqual(
    SUPPORTED_PROVIDER_CATALOG.map((entry) => entry.id),
    ["google", "openrouter"],
  );
  assert.deepEqual(SUPPORTED_PROVIDER_CATALOG.find((entry) => entry.id === "google")?.models, [
    "auto",
    "gemini-4-hydrogen",
    "gemini-3.1-flash-lite",
  ]);
  assert.deepEqual(SUPPORTED_PROVIDER_CATALOG.find((entry) => entry.id === "openrouter")?.models, [
    "openrouter/free",
  ]);
  for (const id of [
    "openai",
    "anthropic",
    "lovable",
    "custom",
    "cerebras",
    "cloudflare",
  ] as const) {
    assert.equal(isSupportedProvider(id), false);
  }
});

test("Gemini task routing uses only the two approved models", () => {
  assert.equal(resolveGeminiModelForTask("quick_log", "auto"), "gemini-3.1-flash-lite");
  assert.equal(resolveGeminiModelForTask("motivation", "auto"), "gemini-3.1-flash-lite");
  assert.equal(resolveGeminiModelForTask("general", "auto"), "gemini-4-hydrogen");
  assert.equal(resolveGeminiModelForTask("coding", "auto"), "gemini-4-hydrogen");
  assert.equal(
    resolveGeminiModelForTask("general", "gemini-3.1-flash-lite"),
    "gemini-3.1-flash-lite",
  );
  assert.equal(resolveGeminiModelForTask("general", "gemini-4-hydrogen"), "gemini-4-hydrogen");
});

test("enabled Gemini is selected only after the user has configured a key", () => {
  const withoutKeys = structuredClone(DEFAULT_PROVIDERS).map((provider) => ({
    ...provider,
    enabled: provider.id === "google",
    apiKey: "",
  }));
  assert.equal(selectProvider(withoutKeys, "general").provider, null);

  const configured = withoutKeys.map((provider) =>
    provider.id === "google" ? { ...provider, apiKey: "test-gemini-key" } : provider,
  );
  const selection = selectProvider(configured, "general");
  assert.equal(selection.provider?.id, "google");
  assert.equal(selection.provider?.model, "auto");
  assert.equal(enabledProviderSummary(configured), "Google Gemini (eigener API-Key)");
  assert.equal(
    classifyTask("Erkläre mir bitte dieses Foto", { hasVisionAttachment: true }),
    "vision",
  );
});

test("BYOK keys stay in volatile account-scoped tab memory and legacy browser values are discarded", () => {
  const userKey = "super-ai-providers-v1:user-1";
  const local = memoryStorage({
    [userKey]: JSON.stringify([{ id: "google", enabled: true, apiKey: "old-local-key" }]),
    "super-ai-providers-v1": JSON.stringify([
      { id: "google", enabled: true, apiKey: "unscoped-previous-user-key" },
    ]),
  });
  const session = memoryStorage({
    [userKey]: JSON.stringify([{ id: "google", enabled: true, apiKey: "old-session-key" }]),
  });
  clearProviderMemory();
  withBrowserStorage(local, session, () => {
    const loaded = loadProviders("user-1");
    assert.equal(loaded.find((provider) => provider.id === "google")?.apiKey, "");
    assert.equal(local.length, 0);
    assert.equal(session.length, 0);

    const configured = loaded.map((provider) =>
      provider.id === "google"
        ? { ...provider, enabled: true, apiKey: "volatile-test-key" }
        : provider,
    );
    saveProviders(configured, "user-1");
    assert.equal(local.length, 0);
    assert.equal(session.length, 0);
    assert.equal(
      loadProviders("user-1").find((provider) => provider.id === "google")?.apiKey,
      "volatile-test-key",
    );
    assert.equal(loadProviders("user-2").find((provider) => provider.id === "google")?.apiKey, "");
  });
  clearProviderMemory();
});

test("provider memory is cleared on logout and absent from a fresh module session", () => {
  const configured = DEFAULT_PROVIDERS.map((provider) =>
    provider.id === "google"
      ? { ...provider, enabled: true, apiKey: "temporary-test-key" }
      : provider,
  );
  withBrowserStorage(memoryStorage(), memoryStorage(), () => {
    saveProviders(configured, "user-1");
    assert.equal(
      loadProviders("user-1").find((provider) => provider.id === "google")?.apiKey,
      "temporary-test-key",
    );
    clearProviderMemory();
    assert.equal(loadProviders("user-1").find((provider) => provider.id === "google")?.apiKey, "");
  });
});

test("logout cleanup clears legacy sensitive values from local and session storage", () => {
  const local = memoryStorage({
    "super-ai-providers-v1:user-1": "old-key",
    "np-watch-snapshot:user-1": "snapshot",
    "keep-this": "safe",
  });
  const session = memoryStorage({
    "super-ai-providers-v1:user-1": "old-key",
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

test("server dispatch is authenticated, restricts providers, and never returns raw provider bodies", () => {
  const server = readFileSync(new URL("../src/lib/super-ai.functions.ts", import.meta.url), "utf8");
  assert.match(server, /middleware\(\[requireSupabaseAuth\]\)/);
  assert.match(server, /if \(provider\.id !== "openrouter" && provider\.id !== "google"\)/);
  assert.match(server, /assertOpenRouterModelAllowed/);
  assert.match(server, /runGeminiChat/);
  assert.match(server, /normalizeProviderApiKey/);
  assert.doesNotMatch(server, /response\.text\(\)|console\.(?:log|error).*apiKey/);
});

test("account-change listener clears volatile provider memory and old storage", () => {
  const root = readFileSync(new URL("../src/routes/__root.tsx", import.meta.url), "utf8");
  assert.match(root, /onAuthStateChange\(\(event, session\)/);
  assert.match(root, /event === "INITIAL_SESSION"/);
  assert.match(root, /currentUserId !== nextUserId/);
  assert.match(root, /clearProviderMemory\(\)/);
  assert.match(root, /clearProviderStorage\(\)/);
  assert.match(
    root,
    /if \(currentUserId && nextUserId && currentUserId !== nextUserId\) \{[\s\S]*?clearSensitiveClientStorage\(\)/,
  );
});

test("Mira in Nexus uses the same account-scoped provider memory", () => {
  const panel = readFileSync(
    new URL("../src/components/chat/MiraNexusPanel.tsx", import.meta.url),
    "utf8",
  );
  assert.match(panel, /loadProviders\(userId\)/);
  assert.match(panel, /toPayload\(selection\.provider\)/);
});

test("provider payload keeps the selected model but omits unrelated account metadata", () => {
  const google = DEFAULT_PROVIDERS.find((provider) => provider.id === "google")!;
  const readyGoogle = { ...google, enabled: true, apiKey: "test-gemini-key" };
  assert.equal(isProviderReady(readyGoogle), true);
  assert.equal(toPayload(readyGoogle).id, "google");
  assert.equal(toPayload(readyGoogle).apiKey, "test-gemini-key");
  assert.equal(toPayload(readyGoogle).accountId, undefined);
  const openrouter = DEFAULT_PROVIDERS.find((provider) => provider.id === "openrouter")!;
  assert.equal(toPayload(openrouter).accountId, undefined);
});
