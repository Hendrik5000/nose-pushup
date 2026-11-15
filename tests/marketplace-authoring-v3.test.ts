import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  MARKETPLACE_FLEX_MANIFEST_SCHEMA_VERSION,
  parseMarketplaceMiraManifestReply,
  validateMarketplaceAuthoredManifest,
} from "../src/lib/marketplace-authoring";
import { describeMarketplaceFunctionality } from "../src/lib/marketplace-runtime";

const FLEX_MANIFEST = {
  schemaVersion: 3,
  name: "Bundesliga-Board",
  description: "Statisches Notizboard für deinen Liga-Überblick (ohne Live-Daten).",
  icon: "leaderboard",
  blocks: [
    { type: "heading", text: "Mein Spieltag" },
    { type: "paragraph", text: "Notiere dir Ergebnisse selbst – diese App hat keine Live-Daten." },
    {
      type: "stats",
      items: [
        { label: "Lieblingsverein", value: "noch offen" },
        { label: "Spieltag", value: "—" },
      ],
    },
    { type: "divider" },
    {
      type: "checklist",
      title: "Vorbereitung",
      items: ["Spielplan prüfen", "Tipps eintragen"],
    },
  ],
};

test("schemaVersion 3 akzeptiert promptgesteuerte Apps mit stats, checklist und divider ohne Aktionen", () => {
  const manifest = validateMarketplaceAuthoredManifest(FLEX_MANIFEST);
  assert.equal(manifest.schemaVersion, MARKETPLACE_FLEX_MANIFEST_SCHEMA_VERSION);
  assert.equal(manifest.blocks.length, 5);
  assert.ok(Object.isFrozen(manifest));
  const stats = manifest.blocks.find((block) => block.type === "stats");
  assert.ok(stats && Object.isFrozen(stats.items));
});

test("schemaVersion 3 erlaubt optional ein Quiz-Spiel", () => {
  const withGame = {
    ...FLEX_MANIFEST,
    game: {
      type: "quiz",
      title: "Liga-Quiz",
      instructions: "Wähle je eine Antwort.",
      questions: [
        { prompt: "Frage 1?", choices: ["A", "B"], correctIndex: 0 },
        { prompt: "Frage 2?", choices: ["A", "B"], correctIndex: 1 },
        { prompt: "Frage 3?", choices: ["A", "B"], correctIndex: 0 },
      ],
      completionMessage: "Geschafft!",
    },
  };
  const manifest = validateMarketplaceAuthoredManifest(withGame);
  assert.equal(manifest.game?.type, "quiz");

  assert.throws(
    () =>
      validateMarketplaceAuthoredManifest({
        ...withGame,
        game: { ...withGame.game, questions: withGame.game.questions.slice(0, 2) },
      }),
    /Quiz/,
  );
});

test("schemaVersion 3 lehnt unbekannte Felder und ungültige Blöcke ab", () => {
  assert.throws(
    () => validateMarketplaceAuthoredManifest({ ...FLEX_MANIFEST, metadata: {} }),
    /nicht unterstützte Felder/,
  );
  assert.throws(
    () =>
      validateMarketplaceAuthoredManifest({
        ...FLEX_MANIFEST,
        blocks: [{ type: "stats", items: [{ label: "X" }] }],
      }),
    /Statistikeintrag/,
  );
  assert.throws(
    () =>
      validateMarketplaceAuthoredManifest({
        ...FLEX_MANIFEST,
        blocks: [{ type: "stats", items: Array.from({ length: 9 }, () => ({ label: "x", value: "y" })) }],
      }),
    /1 bis 8/,
  );
  assert.throws(
    () =>
      validateMarketplaceAuthoredManifest({
        ...FLEX_MANIFEST,
        blocks: [{ type: "checklist", title: "T", items: [] }],
      }),
    /1 bis 8/,
  );
  assert.throws(
    () => validateMarketplaceAuthoredManifest({ ...FLEX_MANIFEST, blocks: [{ type: "divider", extra: 1 }] }),
    /Trennblock/,
  );
  assert.throws(
    () => validateMarketplaceAuthoredManifest({ ...FLEX_MANIFEST, icon: "fussball-live" }),
    /Symbol/,
  );
});

test("v1 verlangt weiter mindestens eine registrierte Aktion (Regression)", () => {
  assert.throws(
    () =>
      validateMarketplaceAuthoredManifest({
        schemaVersion: 1,
        name: "Nur Text",
        description: "Ohne Aktion.",
        icon: "hub",
        blocks: [{ type: "paragraph", text: "Hallo" }],
      }),
    /Alo-Aktionen/,
  );
});

test("parseMarketplaceMiraManifestReply akzeptiert den alo_app-Umschlag", () => {
  const reply = JSON.stringify({ alo_app: FLEX_MANIFEST });
  const manifest = parseMarketplaceMiraManifestReply(reply, "leaderboard");
  assert.equal(manifest.name, "Bundesliga-Board");
  assert.equal(manifest.schemaVersion, 3);
});

test("describeMarketplaceFunctionality beschreibt deklarative Apps mit lokalen Blöcken", () => {
  const manifest = validateMarketplaceAuthoredManifest(FLEX_MANIFEST);
  const described = describeMarketplaceFunctionality(manifest);
  assert.equal(described.label, "Deklarative Alo-App");
  assert.match(described.detail, /lokal/);
});

test("Renderer unterstützt die neuen Blöcke (Regressionsschutz)", () => {
  const view = readFileSync("src/components/marketplace/MarketplaceManifestView.tsx", "utf8");
  assert.ok(view.includes('block.type === "stats"'));
  assert.ok(view.includes('block.type === "checklist"'));
  assert.ok(view.includes('block.type === "divider"'));
  assert.ok(view.includes("MarketplaceChecklistView"));
});
