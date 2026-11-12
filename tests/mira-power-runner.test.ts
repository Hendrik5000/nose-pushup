import assert from "node:assert/strict";
import test from "node:test";
import { runMiraPowerAction } from "../src/lib/mira-power-runner";
import { buildMiraWorkbenchPrompt, MIRA_WORKBENCH_TOOLS } from "../src/lib/mira-workbench";
import type { ProviderConfig } from "../src/lib/ai-providers";
import type { MiraPowerAction } from "../src/components/MiraPowerPanel";

const provider: ProviderConfig = {
  id: "lovable",
  label: "Test-Gateway",
  enabled: true,
  apiKey: "",
  model: "test-model",
  tasks: ["general"],
};

for (const tool of MIRA_WORKBENCH_TOOLS) {
  test(`Werkbank ${tool.id} sendet nur den geprüften Prompt in genau einer Anfrage`, async () => {
    const sent: Array<{
      data: { messages: Array<{ role: string; content: string }>; systemExtra: string };
    }> = [];
    const users: string[] = [];
    const replies: string[] = [];
    const loading: boolean[] = [];
    const prompt = buildMiraWorkbenchPrompt(tool.id, "AUSSCHLIESSLICH_AUSGEWAEHLTE_QUELLE", {
      targetLanguage: "Englisch",
    });
    assert.ok(prompt);

    await runMiraPowerAction(
      { type: "workbench", toolId: tool.id, prompt } satisfies MiraPowerAction,
      {
        send: async (args) => {
          sent.push(args);
          return {
            reply: "Fertige Antwort",
            provider: "lovable",
            model: "test-model",
            task: "general",
          };
        },
        loadProviders: () => [provider],
        generationRef: { current: 0 },
        setLoading: (value) => loading.push(value),
        setError: (value) => assert.equal(value, null),
        setSettingsOpen: () => assert.fail("Aktiver Anbieter darf die Einstellungen nicht öffnen"),
        appendUser: (content) => users.push(content),
        appendAssistant: (content) => replies.push(content),
      },
    );

    assert.equal(sent.length, 1);
    assert.deepEqual(sent[0]?.data.messages, [{ role: "user", content: prompt }]);
    assert.match(sent[0]?.data.systemExtra ?? "", /keine früheren Chatnachrichten/);
    assert.match(sent[0]?.data.systemExtra ?? "", /keine.*Anhänge/);
    assert.doesNotMatch(sent[0]?.data.systemExtra ?? "", /AUSSCHLIESSLICH_AUSGEWAEHLTE_QUELLE/);
    assert.equal("attachments" in (sent[0]?.data ?? {}), false);
    assert.deepEqual(users, [`Mira-Werkbank · ${tool.label} (explizit gestartet)`]);
    assert.deepEqual(replies, ["Fertige Antwort"]);
    assert.deepEqual(loading, [true, false]);
  });
}

test("Werkbank blockiert eine Anfrage, wenn kein Anbieter aktiviert ist", async () => {
  let calls = 0;
  let error = "";
  await runMiraPowerAction(
    { type: "workbench", toolId: "decision_brief", prompt: "Geprüfter Prompt" },
    {
      send: async () => {
        calls += 1;
        return { reply: "", provider: "", model: "", task: "general" };
      },
      loadProviders: () => [],
      generationRef: { current: 0 },
      setLoading: () => undefined,
      setError: (value) => {
        error = value ?? "";
      },
      setSettingsOpen: () => undefined,
      appendUser: () => undefined,
      appendAssistant: () => undefined,
    },
  );
  assert.equal(calls, 0);
  assert.match(error, /Kein aktiver KI-Anbieter/);
});

test("Werkbank zeigt bei Anbieterfehlern keine rohen Schlüssel- oder Antworttexte", async () => {
  const leakedText = "provider response api-secret-sentinel";
  let error = "";
  const replies: string[] = [];
  await runMiraPowerAction(
    { type: "workbench", toolId: "decision_brief", prompt: "Geprüfter Prompt" },
    {
      send: async () => {
        throw new Error(leakedText);
      },
      loadProviders: () => [provider],
      generationRef: { current: 0 },
      setLoading: () => undefined,
      setError: (value) => {
        error = value ?? "";
      },
      setSettingsOpen: () => undefined,
      appendUser: () => undefined,
      appendAssistant: (content) => replies.push(content),
    },
  );
  assert.doesNotMatch(error, /api-secret-sentinel/);
  assert.doesNotMatch(replies.join("\n"), /api-secret-sentinel/);
  assert.match(error, /Anbieter-Einstellungen/);
});
