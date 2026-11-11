import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MiraInteractiveCard } from "../src/components/mira/MiraInteractiveCard.tsx";
import { parseAiResponse } from "../src/lib/ai-plan.ts";
import { getAloOwner, setAloOwner } from "../src/lib/alo-store.ts";
import {
  getPcConfiguratorProfile,
  PC_CONFIGURATOR_PROFILE_VERSION,
  validateMiraInteraction,
  type PcConfiguratorInteraction,
} from "../src/lib/mira-interactions.ts";
import { loadSessions, saveSessions, type AiSession } from "../src/lib/super-ai-tools";

const validInteraction: PcConfiguratorInteraction = {
  type: "pcConfigurator",
  schemaVersion: 1,
  budget: 900,
  resolution: "1080p",
  priority: "fps",
};

function withStorage(initial: Record<string, string>, run: (storage: Map<string, string>) => void) {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const previousOwner = getAloOwner();
  const storage = new Map(Object.entries(initial));
  setAloOwner(null);
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    },
  });
  try {
    run(storage);
  } finally {
    setAloOwner(previousOwner);
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
}

test("pcConfigurator accepts only the fixed versioned allowlist", () => {
  assert.deepEqual(validateMiraInteraction(validInteraction), validInteraction);
  assert.equal(validateMiraInteraction({ ...validInteraction, budget: 600 })?.budget, 600);
  assert.equal(validateMiraInteraction({ ...validInteraction, budget: 3500 })?.budget, 3500);
  assert.equal(validateMiraInteraction({ ...validInteraction, budget: 599 }), null);
  assert.equal(validateMiraInteraction({ ...validInteraction, budget: 3550 }), null);
  assert.equal(validateMiraInteraction({ ...validInteraction, budget: 950 }), null);
  assert.equal(validateMiraInteraction({ ...validInteraction, schemaVersion: 2 }), null);
  assert.equal(validateMiraInteraction({ ...validInteraction, resolution: "720p" }), null);
  assert.equal(validateMiraInteraction({ ...validInteraction, priority: "mods" }), null);
  assert.equal(
    validateMiraInteraction({ ...validInteraction, html: "<script>alert(1)</script>" }),
    null,
  );
});

test("answer parser keeps ordinary text and rejects unknown interaction data", () => {
  assert.deepEqual(
    parseAiResponse(JSON.stringify({ reply: "Dein Zielprofil.", interaction: validInteraction })),
    { reply: "Dein Zielprofil.", plan: null, interaction: validInteraction },
  );
  assert.deepEqual(
    parseAiResponse(
      JSON.stringify({
        reply: "Dieser Text bleibt sichtbar.",
        interaction: { ...validInteraction, priority: "mods" },
      }),
    ),
    { reply: "Dieser Text bleibt sichtbar.", plan: null },
  );
  assert.deepEqual(
    parseAiResponse(
      JSON.stringify({
        reply: "Auch unbekannte Aktionen werden verworfen.",
        interaction: { ...validInteraction, type: "html" },
      }),
    ),
    { reply: "Auch unbekannte Aktionen werden verworfen.", plan: null },
  );
});

test("versioned local profile changes deterministically for budget, resolution and priority", () => {
  const base = getPcConfiguratorProfile(validInteraction);
  assert.equal(base.version, PC_CONFIGURATOR_PROFILE_VERSION);
  assert.deepEqual(base, getPcConfiguratorProfile({ ...validInteraction }));
  assert.notEqual(
    getPcConfiguratorProfile({ ...validInteraction, budget: 2300 }).budgetGuidance,
    base.budgetGuidance,
  );
  assert.notEqual(
    getPcConfiguratorProfile({ ...validInteraction, resolution: "4k" }).resolutionGuidance,
    base.resolutionGuidance,
  );
  assert.notEqual(
    getPcConfiguratorProfile({ ...validInteraction, priority: "quiet" }).priorityGuidance,
    base.priorityGuidance,
  );
});

test("fixed React card exposes local controls and makes no market or execution claims", () => {
  const markup = renderToStaticMarkup(
    createElement(MiraInteractiveCard, {
      interaction: validInteraction,
      onChange: () => undefined,
    }),
  );
  assert.match(markup, /aria-label="Budgetgrenze in Euro"/);
  assert.match(markup, /type="range"[^>]*min="600"[^>]*max="3500"[^>]*step="100"/);
  assert.match(markup, /aria-label="Zielauflösung"/);
  assert.match(markup, /aria-label="Leistungspriorität"/);
  assert.match(markup, /Preis und Verfügbarkeit nicht geprüft/);
  assert.match(markup, /Änderungen werden im Mira-Verlauf gespeichert/);
  assert.doesNotMatch(markup, /<script|<iframe|href=|onClick=/i);
  assert.equal(
    renderToStaticMarkup(
      createElement(MiraInteractiveCard, {
        interaction: { ...validInteraction, html: "<script>bad</script>" },
        onChange: () => undefined,
      }),
    ),
    "",
  );
});

test("selected controls survive the existing Mira session save/load path", () => {
  const session: AiSession = {
    id: "pc-configurator-session",
    title: "PC-Profil",
    updatedAt: "2026-10-31T18:00:00Z",
    messages: [{ role: "assistant", content: "Profil.", interaction: validInteraction }],
  };
  withStorage(
    {
      "super-ai-sessions-v2": JSON.stringify([session]),
      "super-ai-imported-classic-coach": "1",
    },
    (storage) => {
      const loaded = loadSessions();
      const selected: PcConfiguratorInteraction = {
        ...validInteraction,
        budget: 1700,
        resolution: "1440p",
        priority: "quiet",
      };
      const updated = {
        ...loaded[0],
        messages: [{ ...loaded[0].messages[0], interaction: selected }],
      };
      saveSessions([updated]);
      assert.deepEqual(loadSessions()[0]?.messages[0]?.interaction, selected);
      assert.ok(storage.has("super-ai-sessions-v2"));
    },
  );
});

test("Mira keeps the Markdown and Nexus paths separate; card changes remain local", () => {
  const page = readFileSync(
    new URL("../src/components/mira/SuperAiPage.tsx", import.meta.url),
    "utf8",
  );
  const card = readFileSync(
    new URL("../src/components/mira/MiraInteractiveCard.tsx", import.meta.url),
    "utf8",
  );
  assert.equal((page.match(/<MiraInteractiveCard/g) ?? []).length, 2);
  assert.ok(page.includes("<MiraAnswerText text={m.content} />"));
  assert.ok(page.includes('enableNexusDraft={m.role === "assistant"}'));
  assert.match(
    page,
    /messages:\s*nextMsgs\.map\(\(\{ role, content \}\) => \(\{ role, content \}\)\)/,
  );
  assert.match(
    page,
    /\.\.\.\(parsed\.interaction \? \{ interaction: parsed\.interaction \} : \{\}\)/,
  );
  assert.match(
    page,
    /const updateInteraction = \(messageIndex: number, interaction: PcConfiguratorInteraction\)/,
  );
  assert.match(page, /index === messageIndex \? \{ \.\.\.message, interaction \} : message/);
  for (const input of [
    "budget: Number(event.currentTarget.value)",
    "resolution: event.currentTarget.value",
    "priority: event.currentTarget.value",
  ])
    assert.ok(card.includes(input), `missing local configurator input: ${input}`);
  assert.match(
    card,
    /const validated = validateMiraInteraction\(candidate\);\s*if \(validated\) onChange\(validated\)/,
  );
  assert.doesNotMatch(
    card,
    /superAiChat|useServerFn|fetch\(|postMessage|onSend|dangerouslySetInnerHTML|<iframe|<script/i,
  );
});
