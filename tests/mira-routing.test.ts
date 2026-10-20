import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  DEFAULT_PROVIDERS,
  describeProviderSelection,
  providerLabel,
  selectProvider,
} from "../src/lib/ai-providers.ts";

const route = readFileSync(new URL("../src/routes/_authenticated/ai.tsx", import.meta.url), "utf8");

function disabledProviders() {
  return structuredClone(DEFAULT_PROVIDERS).map((provider) => ({
    ...provider,
    enabled: false,
    apiKey: "",
  }));
}

test("provider selection reports the configured task preference without a quality claim", () => {
  const providers = disabledProviders();
  providers[0]!.enabled = true;
  providers[0]!.apiKey = "configured-key";
  providers[0]!.tasks = ["training_plan"];

  const selection = selectProvider(providers, "training_plan");

  assert.equal(selection.provider?.id, "openai");
  assert.equal(selection.reason, "task_preference");
  assert.match(describeProviderSelection(selection, "training_plan"), /„Trainingsplan“/);
  assert.match(
    describeProviderSelection(selection, "training_plan"),
    /als Aufgabenbereich eingetragen/,
  );
  assert.doesNotMatch(
    describeProviderSelection(selection, "training_plan"),
    /bester|Qualität|besser/i,
  );
});

test("when no enabled provider has the task, selection explains first-enabled list fallback", () => {
  const providers = disabledProviders();
  providers[0]!.enabled = true;
  providers[0]!.apiKey = "configured-key";
  providers[0]!.tasks = ["recovery"];
  providers[1]!.enabled = true;
  providers[1]!.apiKey = "configured-key";
  providers[1]!.tasks = ["form_technique"];

  const selection = selectProvider(providers, "quick_log");
  const reason = describeProviderSelection(selection, "quick_log");

  assert.equal(selection.provider?.id, "openai");
  assert.equal(selection.reason, "first_enabled_fallback");
  assert.match(reason, /schnelles Trainingsprotokoll/);
  assert.match(reason, /der erste aktivierte Anbieter in der Liste \(OpenAI\)/);
});

test("no enabled providers is reported as no selection", () => {
  const selection = selectProvider(disabledProviders(), "general");
  assert.equal(selection.provider, null);
  assert.equal(selection.reason, "no_provider");
  assert.match(describeProviderSelection(selection, "general"), /Kein aktivierter Anbieter/);
});

test("Lovable is identified as the gateway, not as a known downstream model backend", () => {
  assert.equal(providerLabel("lovable"), "Lovable Gateway");
  assert.match(route, /Lovable Gateway; das interne Backend ist nicht ausgewiesen\./);
  assert.match(route, /Anbieter für diese Antwort:[\s\S]{0,100}providerLabel\(m\.meta\.provider/);
  assert.match(route, /Modellkennung: \{m\.meta\.model\}/);
});

test("the next-request provider is explicitly a preview, while each reply carries its own choice and reason", () => {
  assert.match(route, /Anbietervorschau für die nächste Anfrage/);
  assert.match(route, /Vorschau nächste Anfrage:/);
  assert.match(
    route,
    /provider: res\.provider,[\s\S]*?routingReason: describeProviderSelection\(selection, task\)/,
  );
  assert.match(route, /Auswahlregel: \{m\.meta\.routingReason\}/);
  assert.equal((route.match(/\bsend\(\{/g) ?? []).length, 1);
});
