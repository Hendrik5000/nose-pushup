import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DEFAULT_PROVIDERS } from "../src/lib/ai-providers";
import {
  buildMarketplaceMiraRequest,
  generateMarketplaceManifestDraft,
  validateMarketplaceAuthoredManifest,
} from "../src/lib/marketplace-authoring";
import { classifyMarketplaceChatIntent } from "../src/lib/marketplace-chat-intent";
import { presentMiraMarketplaceReply } from "../src/lib/mira-marketplace-reply";
import { isExplicitMiraCodeRequest } from "../src/lib/mira-response-policy";

const manifest = {
  schemaVersion: 1,
  name: "Trainingsstart",
  description: "Öffnet den vorhandenen Trainingsbereich.",
  icon: "training",
  blocks: [
    { type: "heading", text: "Los geht's" },
    { type: "paragraph", text: "Öffne eine vorhandene Alo-Seite." },
    { type: "action", label: "Trainingsprogramme", actionId: "route:/programs" },
  ],
};
const inventedFootballApp = JSON.stringify({
  alo_app: {
    version: "1.0.1",
    manifest: {
      metadata: { title: "FotMob Style Bundesliga", icon: "LayoutDashboard" },
      screens: [
        { id: "scores_view", components: [{ type: "data_list", data_source: "bundesliga_live" }] },
      ],
    },
  },
});
const page = readFileSync(
  new URL("../src/components/mira/SuperAiPage.tsx", import.meta.url),
  "utf8",
);

test("natural football app wishes enter existing authoring rather than ordinary chat", () => {
  for (const request of [
    "Fußball App wie FotMob",
    "Eine Fußball Ergebnisse App so wie FotMob",
    "Ich hätte gerne eine Fußballapp wie FotMob",
    "Mach mir eine Fußball-App wie FotMob",
    "Programmiere mir eine Fußball App",
    "Erstelle eine App mit einer Funktion für meine Planung",
    "Ich möchte eine Fußball App ohne Code",
  ])
    assert.equal(classifyMarketplaceChatIntent(request), "create", request);
});

test("information, negations, existing apps and requested source stay out of authoring", () => {
  for (const request of [
    "Kennst du eine App wie FotMob?",
    "Welche App ist wie FotMob?",
    "Die App wie FotMob gefällt mir",
    "Ich möchte keine Fußballapp",
    "Ich möchte WhatsApp öffnen",
    "Erkläre mir eine Fußball-App",
    "Zeige mir das JSON-Manifest der App",
    "Erstelle JSON für die App",
  ])
    assert.equal(classifyMarketplaceChatIntent(request), null, request);
  assert.equal(classifyMarketplaceChatIntent("Mach den Button kürzer", true), "edit-draft");
  assert.equal(classifyMarketplaceChatIntent("Ändere meine App Trainingsstart"), "edit-published");
});

test("ordinary valid manifest answers become validated read-only presentations", () => {
  for (const raw of [
    JSON.stringify(manifest),
    `\`\`\`json\n${JSON.stringify(manifest)}\n\`\`\``,
    JSON.stringify(JSON.stringify(manifest)),
    `Hier ist die Vorschau:\n${JSON.stringify({ manifest })}`,
  ]) {
    const result = presentMiraMarketplaceReply(raw, "Fußball App wie FotMob");
    assert.deepEqual(result.manifest, validateMarketplaceAuthoredManifest(manifest));
    assert.match(result.reply, /Lokale Vorschau/);
    assert.match(result.reply, /Nicht veröffentlicht/);
    assert.match(result.reply, /nur diese geprüften Alo-Aktionen/);
    assert.match(result.reply, /Externe Live-Datenquellen und nicht registrierte Aktionen/);
    assert.doesNotMatch(result.reply, /schemaVersion|actionId|blocks/);
  }
});

test("the observed unsupported alo_app/screens response never becomes ordinary visible JSON", () => {
  for (const raw of [
    inventedFootballApp,
    `\`\`\`json\n${inventedFootballApp}\n\`\`\``,
    JSON.stringify(inventedFootballApp),
  ]) {
    const result = presentMiraMarketplaceReply(raw, "Fußball App wie FotMob");
    assert.equal(result.manifest, undefined);
    assert.match(result.reply, /nicht unterstütztes Format/);
    assert.match(result.reply, /keine App gespeichert oder veröffentlicht/);
    assert.doesNotMatch(result.reply, /alo_app|screens|bundesliga_live/);
  }
});

test("unknown fields, executable content and truncated app payloads remain rejected", () => {
  for (const raw of [
    JSON.stringify({ ...manifest, screens: [] }),
    JSON.stringify({ ...manifest, blocks: [{ type: "html", text: "<script>bad()</script>" }] }),
    JSON.stringify({ ...manifest, icon: "https://invalid.test/logo.svg" }),
    '{"alo_app": {"manifest":',
    '{"schemaVersion": 1, "blocks": [',
  ]) {
    assert.equal(presentMiraMarketplaceReply(raw, "Erstelle eine App").manifest, undefined);
    assert.match(
      presentMiraMarketplaceReply(raw, "Erstelle eine App").reply,
      /nicht unterstütztes Format/,
    );
  }
});

test("explicit JSON/code survives while app function requests and no-code requests do not opt in", () => {
  for (const request of [
    "Zeige mir das JSON-Manifest der App",
    "Gib mir den Code der App",
    "Schreib mir den TypeScript-Code",
  ]) {
    assert.equal(isExplicitMiraCodeRequest(request), true, request);
    assert.deepEqual(presentMiraMarketplaceReply(inventedFootballApp, request), {
      reply: inventedFootballApp,
    });
  }
  for (const request of [
    "Erstelle eine App mit einer Funktion für Planung",
    "Zeige die App ohne Code",
    "Ich möchte keine JSON-Ausgabe",
  ]) {
    assert.equal(isExplicitMiraCodeRequest(request), false, request);
  }
  for (const text of [
    "Hier sind drei Ideen.",
    'Die Bezeichnung "alo_app" ist ein Formatname.',
    '{"reply":"Hallo","visual":{"schemaVersion":1}}',
  ]) {
    assert.deepEqual(presentMiraMarketplaceReply(text, "Erkläre mir das"), { reply: text });
  }
});

test("both layouts and answer actions consume presented text, not raw app artifacts", () => {
  assert.equal((page.match(/displayMessages\.map\(\(m, i\)/g) ?? []).length, 2);
  assert.equal(
    (page.match(/<MarketplaceManifestView manifest=\{m\.marketplaceManifest\} preview \/>/g) ?? [])
      .length,
    2,
  );
  assert.match(page, /content: presentation\.reply/);
  assert.match(page, /return assistantPresentation\.reply/);
  assert.match(page, /onSpeak=\{\(\) => speakMiraMessage\(i, m\.content\)\}/);
  assert.match(page, /onCopy=\{\(\) => void copyText\(m\.content\)\}/);
  assert.doesNotMatch(page, /\{messages\.map\(\(m, i\)/);
});

test("authoring progress follows the actual one-request flow without fake delays or exposed provider errors", () => {
  assert.equal((page.match(/label=\{marketplaceProgress \?\? undefined\}/g) ?? []).length, 2);
  assert.match(page, /App-Erstellung wird vorbereitet/);
  assert.match(page, /Mira erstellt den App-Entwurf/);
  assert.match(page, /App-Entwurf wird geprüft/);
  const flow = page.slice(page.indexOf("if (marketplaceIntent)"), page.indexOf("// Non-admins"));
  assert.equal((flow.match(/await generateMarketplaceManifestDraft\(/g) ?? []).length, 1);
  assert.doesNotMatch(flow, /setTimeout|setInterval|error\.message/);
  assert.match(flow, /restoreMiraComposerTextAfterFailure/);
});

test("one explicit request gets exact schema guidance and honest capability limits with no retry", async () => {
  const provider = DEFAULT_PROVIDERS.find((entry) => entry.id === "lovable");
  assert.ok(provider);
  const request = buildMarketplaceMiraRequest("Fußball App wie FotMob", provider);
  assert.equal(request.data.messages.length, 1);
  assert.match(
    request.data.systemExtra,
    /Kein alo_app-Wrapper, metadata, screens, components oder data_source/,
  );
  assert.match(request.data.systemExtra, /keine Fußball-Ergebnisse oder Sportligen/);
  assert.match(request.data.systemExtra, /statischer Inhalt ist nicht live/);
  assert.match(request.data.systemExtra, /keine Übernahme fremder Marken/);
  assert.equal("attachments" in request.data, false);
  let calls = 0;
  await assert.rejects(
    generateMarketplaceManifestDraft("Fußball App wie FotMob", provider, async () => {
      calls += 1;
      return { reply: inventedFootballApp, provider: "lovable", model: "test", task: "general" };
    }),
  );
  assert.equal(calls, 1);
});
