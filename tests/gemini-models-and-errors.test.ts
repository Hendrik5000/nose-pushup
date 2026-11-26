import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  GEMINI_MODEL_LABELS,
  isGeminiModelMode,
  resolveGeminiModelForTask,
} from "../src/lib/gemini-models.ts";
import {
  normalizeProviderApiKey,
  safeGeminiError,
  safeOpenRouterErrorMessage,
} from "../src/lib/ai-provider-errors.ts";
import { DEFAULT_PROVIDERS, selectProvider } from "../src/lib/ai-providers.ts";

const read = (file: string) => readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8");

test("Gemini exposes exactly the approved Hydrogen and Flash-Lite models plus automatic mode", () => {
  assert.deepEqual(Object.keys(GEMINI_MODEL_LABELS), [
    "auto",
    "gemini-4-hydrogen",
    "gemini-3.1-flash-lite",
  ]);
  assert.equal(isGeminiModelMode("auto"), true);
  assert.equal(isGeminiModelMode("gemini-4-hydrogen"), true);
  assert.equal(isGeminiModelMode("gemini-3.1-flash-lite"), true);
  assert.equal(isGeminiModelMode("gemini-2.5-pro"), false);
  assert.equal(isGeminiModelMode("custom-model"), false);
});

test("automatic task routing maps only quick tasks to Flash-Lite and other work to Hydrogen", () => {
  for (const task of ["quick_log", "motivation", "chat_summary"]) {
    assert.equal(resolveGeminiModelForTask(task), "gemini-3.1-flash-lite");
  }
  for (const task of ["general", "vision", "science", "coding", "unknown"]) {
    assert.equal(resolveGeminiModelForTask(task), "gemini-4-hydrogen");
  }
  assert.equal(
    resolveGeminiModelForTask("general", "gemini-3.1-flash-lite"),
    "gemini-3.1-flash-lite",
  );
  assert.equal(resolveGeminiModelForTask("general", "gemini-4-hydrogen"), "gemini-4-hydrogen");
});

test("API-key normalization accepts a trimmed key and rejects malformed or oversized values", () => {
  assert.equal(normalizeProviderApiKey("  test-key-123  "), "test-key-123");
  assert.equal(normalizeProviderApiKey(undefined), "");
  assert.equal(normalizeProviderApiKey(123), "");
  assert.throws(() => normalizeProviderApiKey(`k${"x".repeat(500)}`), /ungültig oder zu lang/);
  assert.throws(() => normalizeProviderApiKey("part-one\npart-two"), /ungültig oder zu lang/);
});

test("Gemini SDK failures are replaced with safe messages that never echo keys or provider details", () => {
  const marker = "DO_NOT_LEAK_GEMINI_API_KEY_123";
  for (const status of [401, 403, 404, 429, 500]) {
    const safe = safeGeminiError({
      status,
      message: `upstream body included ${marker}`,
      details: { key: marker },
    });
    assert.ok(safe instanceof Error);
    assert.doesNotMatch(safe.message, new RegExp(marker));
    assert.doesNotMatch(safe.stack ?? "", new RegExp(marker));
  }
  const unknown = safeGeminiError(`raw SDK failure ${marker}`);
  assert.doesNotMatch(unknown.message, new RegExp(marker));
});


test("Gemini SDK nested HTTP and symbolic status fields map to safe actionable errors", () => {
  assert.match(safeGeminiError({ response: { status: 429 }, message: "private" }).message, /Kontingent/);
  assert.match(safeGeminiError({ cause: { code: "UNAUTHENTICATED" } }).message, /API-Key/);
  assert.match(safeGeminiError({ code: "INVALID_ARGUMENT" }).message, /Anfrage abgelehnt/);
  assert.match(safeGeminiError({ response: { status: 503 } }).message, /nicht verfügbar/);
});

test("manual Mira model selection routes to the selected configured provider and model", () => {
  const providers = DEFAULT_PROVIDERS.map((provider) =>
    provider.id === "google"
      ? { ...provider, enabled: true, apiKey: "test-key" }
      : provider,
  );
  const selected = selectProvider(providers, "general", { requestedModel: "gemini-3.1-flash-lite" });
  assert.equal(selected.provider?.id, "google");
  assert.equal(selected.provider?.model, "gemini-3.1-flash-lite");
  assert.equal(selectProvider(DEFAULT_PROVIDERS, "general", { requestedModel: "gemini-4-hydrogen" }).provider, null);
});

test("OpenRouter error messages do not include upstream bodies or credentials", () => {
  const marker = "DO_NOT_LEAK_OPENROUTER_KEY_456";
  for (const status of [401, 403, 404, 429, 500]) {
    const safe = safeOpenRouterErrorMessage(status);
    assert.doesNotMatch(safe, new RegExp(marker));
    assert.match(safe, /OpenRouter/);
  }
  const server = read("lib/super-ai.functions.ts");
  assert.match(server, /safeOpenRouterErrorMessage\(response\.status\)/);
  assert.doesNotMatch(server, /response\.text\(\)/);
});

test("Gemini runs server-side with a fixed token cap and only approved models", () => {
  const server = read("lib/gemini.server.ts");
  assert.match(server, /MAX_OUTPUT_TOKENS = 1200/);
  assert.match(server, /new GoogleGenAI\(\{ apiKey: normalizedApiKey \}\)/);
  assert.match(server, /isGeminiModelMode\(requestedModel\)/);
  assert.match(server, /safeGeminiError\(error\)/);
  assert.doesNotMatch(server, /console\.(?:log|error).*apiKey/);
  const mira = read("components/mira/SuperAiPage.tsx");
  assert.match(mira, /aria-label="Mira-Modell auswählen"/);
  assert.match(mira, /requestedModel/);
});
