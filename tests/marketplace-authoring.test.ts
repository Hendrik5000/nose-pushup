import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { DEFAULT_PROVIDERS } from "../src/lib/ai-providers";
import {
  EMPTY_MARKETPLACE_PUBLISHED_INSTALL_STATE,
  MARKETPLACE_ICON_IDS,
  MARKETPLACE_MAX_BLOCKS,
  buildMarketplaceMiraRequest,
  describeMarketplaceAuthoredPermissions,
  generateMarketplaceManifestDraft,
  installMarketplacePublishedApp,
  loadMarketplacePublishedInstallState,
  marketplacePublishedInstallStorageKey,
  parseMarketplaceMiraManifestReply,
  parseMarketplacePublishedVersions,
  parseMarketplacePublishedInstallState,
  removeMarketplacePublishedApp,
  saveMarketplacePublishedInstallState,
  setMarketplacePublishedAppEnabled,
  updateMarketplacePublishedAppVersion,
  validateMarketplaceAuthoredManifest,
} from "../src/lib/marketplace-authoring";
import { MARKETPLACE_AUTHOR_ACTIONS, MARKETPLACE_CATALOG } from "../src/lib/marketplace";

const APP_ID = "8c2e1891-c4da-4c12-a47d-9fb0bda5d712";
const VALID_MANIFEST = {
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

class MemoryStorage {
  readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

function samplePublishedRow(overrides: Record<string, unknown> = {}) {
  return {
    app_id: APP_ID,
    version: 1,
    current_version: 1,
    manifest: VALID_MANIFEST,
    created_at: "2026-11-06T20:00:00.000Z",
    can_manage: true,
    ...overrides,
  };
}

test("authored manifests accept only the versioned fixed UI schema and pre-registered actions", () => {
  const parsed = validateMarketplaceAuthoredManifest(VALID_MANIFEST);
  assert.equal(parsed.name, "Trainingsstart");
  assert.equal(parsed.schemaVersion, 1);
  assert.ok(Object.isFrozen(parsed));
  assert.ok(Object.isFrozen(parsed.blocks));
  assert.ok(Object.isFrozen(parsed.blocks[0]));
  assert.deepEqual(describeMarketplaceAuthoredPermissions(parsed), [
    "Öffnet nach deinem Tippen ausschließlich das vorregistrierte Alo-Ziel „Programme“. Keine zusätzlichen Plugin-Datenrechte oder Hintergrundaktionen.",
  ]);
  assert.equal(MARKETPLACE_ICON_IDS.includes(parsed.icon), true);

  for (const forbidden of ["code", "html", "script", "url", "permissions", "provider", "network"]) {
    assert.throws(
      () => validateMarketplaceAuthoredManifest({ ...VALID_MANIFEST, [forbidden]: "not allowed" }),
      /nicht unterstützte Felder/,
      `${forbidden} must not be a manifest field`,
    );
  }
  assert.throws(
    () => validateMarketplaceAuthoredManifest({ ...VALID_MANIFEST, schemaVersion: 2 }),
    /Manifestversion/,
  );
  assert.throws(
    () => validateMarketplaceAuthoredManifest({ ...VALID_MANIFEST, icon: "remote-image" }),
    /Symbol/,
  );
  assert.throws(
    () =>
      validateMarketplaceAuthoredManifest({
        ...VALID_MANIFEST,
        blocks: [{ type: "script", code: "alert(1)" }],
      }),
    /Block|Aktionsblöcke|Alo-App/,
  );
});

test("HTML, scriptable URLs, unsupported actions, extra block fields and duplicate actions fail closed", () => {
  for (const text of [
    "<script>alert(1)</script>",
    "javascript:alert(1)",
    "https://evil.invalid",
    "<b>fett</b>",
    "safe\u202Etxt",
    "safe\u2066txt\u2069",
  ]) {
    assert.throws(
      () =>
        validateMarketplaceAuthoredManifest({
          ...VALID_MANIFEST,
          blocks: [
            { type: "paragraph", text },
            { type: "action", label: "Öffnen", actionId: "route:/programs" },
          ],
        }),
      /ungültig|freigegebene|überschreitet/i,
    );
  }
  assert.throws(
    () =>
      validateMarketplaceAuthoredManifest({
        ...VALID_MANIFEST,
        blocks: [{ type: "action", label: "Extern", actionId: "route:https://example.invalid" }],
      }),
    /nicht freigegebene/,
  );
  assert.throws(
    () =>
      validateMarketplaceAuthoredManifest({
        ...VALID_MANIFEST,
        blocks: [{ type: "action", label: "Öffnen", actionId: "tool:grant-admin" }],
      }),
    /nicht freigegebene/,
  );
  assert.throws(
    () =>
      validateMarketplaceAuthoredManifest({
        ...VALID_MANIFEST,
        blocks: [
          { type: "action", label: "A", actionId: "route:/programs" },
          { type: "action", label: "B", actionId: "route:/programs" },
        ],
      }),
    /doppelt/,
  );
  assert.throws(
    () =>
      validateMarketplaceAuthoredManifest({
        ...VALID_MANIFEST,
        blocks: [{ type: "action", label: "Öffnen", actionId: "route:/programs", html: "<b>" }],
      }),
    /Überschüssige Felder/,
  );
  assert.throws(
    () =>
      validateMarketplaceAuthoredManifest({
        ...VALID_MANIFEST,
        blocks: Array.from({ length: MARKETPLACE_MAX_BLOCKS + 1 }, (_, index) => ({
          type: "paragraph",
          text: `Text ${index}`,
        })).concat([{ type: "action", label: "Öffnen", actionId: "route:/programs" }]),
      }),
    /1 bis 12/,
  );
  assert.throws(
    () =>
      validateMarketplaceAuthoredManifest({
        ...VALID_MANIFEST,
        blocks: [
          { type: "action", label: "A", actionId: "route:/programs" },
          { type: "action", label: "B", actionId: "route:/health" },
          { type: "action", label: "C", actionId: "route:/run" },
          { type: "action", label: "D", actionId: "tool:search" },
          { type: "action", label: "E", actionId: "tool:today" },
        ],
      }),
    /1 bis 4/,
  );
  assert.throws(
    () =>
      validateMarketplaceAuthoredManifest({
        ...VALID_MANIFEST,
        description: "x".repeat(20_000),
      }),
    /Größenlimit/,
  );
});

test("the authoring action allowlist is derived from first-party entries and excludes recursive Marketplace access", () => {
  assert.equal(MARKETPLACE_AUTHOR_ACTIONS.length, 28);
  assert.ok(Object.isFrozen(MARKETPLACE_AUTHOR_ACTIONS));
  assert.ok(MARKETPLACE_AUTHOR_ACTIONS.every((entry) => typeof entry.action === "object"));
  assert.ok(MARKETPLACE_AUTHOR_ACTIONS.every((entry) => entry.id !== "route:/marketplace"));
  assert.ok(MARKETPLACE_AUTHOR_ACTIONS.some((entry) => entry.id === "route:/admin"));
  assert.ok(MARKETPLACE_AUTHOR_ACTIONS.some((entry) => entry.id === "game:grid-defense"));
  assert.ok(MARKETPLACE_AUTHOR_ACTIONS.some((entry) => entry.id === "tool:privacy"));
  assert.ok(MARKETPLACE_CATALOG.every((entry) => typeof entry.action !== "function"));
});

test("Mira receives one explicit goal and fixed action list, never prior chat or private app context", async () => {
  const provider = DEFAULT_PROVIDERS.find((entry) => entry.id === "lovable");
  assert.ok(provider);
  const request = buildMarketplaceMiraRequest(
    "Eine Schnellstartseite für Trainingsprogramme",
    provider,
  );
  assert.deepEqual(Object.keys(request.data).sort(), [
    "messages",
    "provider",
    "systemExtra",
    "task",
  ]);
  assert.equal(request.data.messages.length, 1);
  assert.equal(request.data.messages[0].role, "user");
  assert.match(request.data.messages[0].content, /Schnellstartseite/);
  assert.equal(request.data.task, "general");
  assert.match(request.data.systemExtra, /Keine HTML-, JavaScript-/);
  assert.match(request.data.systemExtra, /route:\/programs/);
  assert.match(request.data.systemExtra, /tool:privacy/);
  assert.doesNotMatch(
    request.data.systemExtra,
    /private|gesundheitliche Daten|Trainingsdaten aus dem Profil/i,
  );
  assert.equal("attachments" in request.data, false);
  assert.equal("history" in request.data, false);
  assert.equal("context" in request.data, false);

  let sendCount = 0;
  let captured: unknown;
  const generated = await generateMarketplaceManifestDraft(
    "Eine Schnellstartseite für Trainingsprogramme",
    provider,
    async (outgoing) => {
      sendCount += 1;
      captured = outgoing;
      return {
        reply: JSON.stringify(VALID_MANIFEST),
        provider: "lovable",
        model: "test",
        task: "general",
      };
    },
  );
  assert.equal(sendCount, 1);
  assert.deepEqual(generated, validateMarketplaceAuthoredManifest(VALID_MANIFEST));
  assert.deepEqual(Object.keys(captured as object), ["data"]);

  const component = readFileSync(
    new URL("../src/components/marketplace/MarketplaceCustomApps.tsx", import.meta.url),
    "utf8",
  );
  assert.match(component, /onClick=\{\(\) => void onGenerate\(\)\}/);
  const effectBodies = component
    .split("useEffect(() => {")
    .slice(1)
    .map((effect) => effect.split("}, [")[0]);
  assert.ok(effectBodies.length >= 2);
  assert.ok(effectBodies.every((effect) => !effect.includes("generateMarketplaceManifestDraft")));
  assert.match(
    component,
    /Frühere Chats, Anhänge[\s\S]*?Gesundheits- oder Trainingsdaten werden nicht automatisch/,
  );
});

test("Mira response parser requires a complete JSON object and validates fenced JSON identically", () => {
  assert.deepEqual(
    parseMarketplaceMiraManifestReply(JSON.stringify(VALID_MANIFEST)),
    validateMarketplaceAuthoredManifest(VALID_MANIFEST),
  );
  assert.deepEqual(
    parseMarketplaceMiraManifestReply(`\`\`\`json\n${JSON.stringify(VALID_MANIFEST)}\n\`\`\``),
    validateMarketplaceAuthoredManifest(VALID_MANIFEST),
  );
  assert.throws(
    () => parseMarketplaceMiraManifestReply(`Hier ist die App: ${JSON.stringify(VALID_MANIFEST)}`),
    /JSON-Manifest/,
  );
  assert.throws(() => parseMarketplaceMiraManifestReply("{not json}"), /JSON-Manifest/);
  assert.throws(() => parseMarketplaceMiraManifestReply(`${"x".repeat(40_000)}`), /zu groß/);
});

test("published versions validate exact server rows and reject malformed or unsafe records", () => {
  const rows = parseMarketplacePublishedVersions([
    {
      app_id: APP_ID,
      version: 1,
      current_version: 2,
      manifest: VALID_MANIFEST,
      created_at: "2026-11-06T20:00:00Z",
      can_manage: true,
    },
  ]);
  assert.equal(rows[0].appId, APP_ID);
  assert.equal(rows[0].version, 1);
  assert.equal(rows[0].currentVersion, 2);
  assert.equal(rows[0].canManage, true);
  assert.ok(Object.isFrozen(rows));
  assert.throws(
    () => parseMarketplacePublishedVersions([{ ...samplePublishedRow(), unexpected: true }]),
    /Datensatz/,
  );
  const unsafeRow = samplePublishedRow({
    manifest: {
      ...VALID_MANIFEST,
      blocks: [{ type: "action", label: "No", actionId: "route:/evil" }],
    },
  });
  assert.throws(() => parseMarketplacePublishedVersions([unsafeRow]), /nicht freigegebene/);
  assert.throws(
    () =>
      parseMarketplacePublishedVersions([samplePublishedRow({ version: 3, current_version: 2 })]),
    /Datensatz/,
  );
  assert.throws(
    () => parseMarketplacePublishedVersions([samplePublishedRow(), samplePublishedRow()]),
    /Doppelte/,
  );
  assert.throws(
    () =>
      parseMarketplacePublishedVersions(Array.from({ length: 501 }, () => samplePublishedRow())),
    /zu groß/,
  );
});

test("published app local installs remain account/backend scoped, disabled by default and explicitly pinned", () => {
  const storage = new MemoryStorage();
  const installedV1 = installMarketplacePublishedApp(
    EMPTY_MARKETPLACE_PUBLISHED_INSTALL_STATE,
    APP_ID,
    1,
  );
  assert.deepEqual(installedV1.installs, [{ appId: APP_ID, version: 1, enabled: false }]);
  assert.throws(() => installMarketplacePublishedApp(installedV1, APP_ID, 2), /gepinnt/);
  const enabledV1 = setMarketplacePublishedAppEnabled(installedV1, APP_ID, 1, true);
  assert.equal(enabledV1.installs[0].enabled, true);
  assert.throws(
    () => setMarketplacePublishedAppEnabled(enabledV1, APP_ID, 2, true),
    /stimmt nicht/,
  );

  const explicitlyUpdated = updateMarketplacePublishedAppVersion(enabledV1, APP_ID, 2);
  assert.deepEqual(explicitlyUpdated.installs, [{ appId: APP_ID, version: 2, enabled: true }]);
  const disabledV2 = setMarketplacePublishedAppEnabled(explicitlyUpdated, APP_ID, 2, false);
  const removed = removeMarketplacePublishedApp(disabledV2, APP_ID);
  assert.deepEqual(removed, EMPTY_MARKETPLACE_PUBLISHED_INSTALL_STATE);

  saveMarketplacePublishedInstallState(storage, "admin-a", enabledV1);
  assert.deepEqual(loadMarketplacePublishedInstallState(storage, "admin-a"), enabledV1);
  assert.deepEqual(
    loadMarketplacePublishedInstallState(storage, "admin-b"),
    EMPTY_MARKETPLACE_PUBLISHED_INSTALL_STATE,
  );
  assert.notEqual(
    marketplacePublishedInstallStorageKey("admin-a"),
    marketplacePublishedInstallStorageKey("admin-b"),
  );
  const key = marketplacePublishedInstallStorageKey("admin-a");
  const malformed = JSON.stringify({
    schemaVersion: 1,
    installs: [
      { appId: APP_ID, version: 1, enabled: true, packageUrl: "https://evil.invalid/a.js" },
    ],
  });
  storage.setItem(key, malformed);
  assert.deepEqual(
    loadMarketplacePublishedInstallState(storage, "admin-a"),
    EMPTY_MARKETPLACE_PUBLISHED_INSTALL_STATE,
  );
  assert.equal(storage.getItem(key), malformed, "invalid storage is not rewritten");
  assert.throws(
    () =>
      parseMarketplacePublishedInstallState({
        schemaVersion: 1,
        installs: [{ appId: "not-a-uuid", version: 1, enabled: false }],
      }),
    /Installation/,
  );
});
