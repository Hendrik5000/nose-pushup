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
  setMarketplacePublishedAppPermissions,
  setMarketplacePublishedAppEnabled,
  updateMarketplacePublishedAppVersion,
  validateMarketplaceAuthoredManifest,
} from "../src/lib/marketplace-authoring";
import { MARKETPLACE_AUTHOR_ACTIONS, MARKETPLACE_CATALOG } from "../src/lib/marketplace";
import {
  classifyMarketplaceChatIntent,
  findMarketplaceAppReference,
} from "../src/lib/marketplace-chat-intent";

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

const VALID_GAME_MANIFEST = {
  schemaVersion: 2,
  name: "Wissensquiz",
  description: "Ein kurzes lokales Quiz zum Mitspielen.",
  icon: "game",
  blocks: [],
  game: {
    type: "quiz",
    title: "Wissensquiz",
    instructions: "Wähle für jede Frage eine Antwort.",
    questions: [
      {
        prompt: "Wie viel ist 2 + 2?",
        choices: ["3", "4", "5"],
        correctIndex: 1,
        explanation: "Zwei plus zwei ergibt vier.",
      },
      {
        prompt: "Welcher Planet wird der rote Planet genannt?",
        choices: ["Mars", "Venus"],
        correctIndex: 0,
      },
      {
        prompt: "Wie viele Tage hat eine Woche?",
        choices: ["7", "8"],
        correctIndex: 0,
      },
    ],
    completionMessage: "Gut gespielt!",
  },
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
    () => validateMarketplaceAuthoredManifest({ ...VALID_MANIFEST, schemaVersion: 3 }),
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

test("v2 quiz manifests are local, bounded, deeply frozen, and require no Alo actions", () => {
  const parsed = validateMarketplaceAuthoredManifest(VALID_GAME_MANIFEST);
  assert.equal(parsed.schemaVersion, 2);
  assert.equal(parsed.game?.type, "quiz");
  assert.equal(parsed.blocks.length, 0);
  assert.ok(Object.isFrozen(parsed.game));
  assert.ok(Object.isFrozen(parsed.game?.questions));
  assert.ok(Object.isFrozen(parsed.game?.questions[0]));
  assert.ok(Object.isFrozen(parsed.game?.questions[0].choices));
  assert.deepEqual(describeMarketplaceAuthoredPermissions(parsed), []);

  assert.throws(
    () => validateMarketplaceAuthoredManifest({ ...VALID_GAME_MANIFEST, game: undefined }),
    /Quiz-Spielmanifest/,
  );
  assert.throws(
    () =>
      validateMarketplaceAuthoredManifest({ ...VALID_MANIFEST, game: VALID_GAME_MANIFEST.game }),
    /nicht unterstützte Felder/,
  );
  assert.throws(
    () =>
      validateMarketplaceAuthoredManifest({
        ...VALID_GAME_MANIFEST,
        game: { ...VALID_GAME_MANIFEST.game, type: "script" },
      }),
    /Quiz-Spielmanifest/,
  );
  assert.throws(
    () =>
      validateMarketplaceAuthoredManifest({
        ...VALID_GAME_MANIFEST,
        game: { ...VALID_GAME_MANIFEST.game, executable: "alert(1)" },
      }),
    /Quiz-Spielmanifest/,
  );
  assert.throws(
    () =>
      validateMarketplaceAuthoredManifest({
        ...VALID_GAME_MANIFEST,
        game: {
          ...VALID_GAME_MANIFEST.game,
          questions: [
            { ...VALID_GAME_MANIFEST.game.questions[0], correctIndex: 3 },
            ...VALID_GAME_MANIFEST.game.questions.slice(1),
          ],
        },
      }),
    /Lösungsindex/,
  );
  assert.throws(
    () =>
      validateMarketplaceAuthoredManifest({
        ...VALID_GAME_MANIFEST,
        game: {
          ...VALID_GAME_MANIFEST.game,
          questions: [
            { ...VALID_GAME_MANIFEST.game.questions[0], choices: ["gleich", "Gleich"] },
            ...VALID_GAME_MANIFEST.game.questions.slice(1),
          ],
        },
      }),
    /dürfen sich nicht wiederholen/,
  );
  assert.throws(
    () =>
      validateMarketplaceAuthoredManifest({
        ...VALID_GAME_MANIFEST,
        game: {
          ...VALID_GAME_MANIFEST.game,
          questions: [
            { ...VALID_GAME_MANIFEST.game.questions[0], prompt: "javascript:alert(1)" },
            ...VALID_GAME_MANIFEST.game.questions.slice(1),
          ],
        },
      }),
    /Quizfrage ist ungültig/,
  );
  assert.throws(
    () =>
      validateMarketplaceAuthoredManifest({
        ...VALID_GAME_MANIFEST,
        game: {
          ...VALID_GAME_MANIFEST.game,
          questions: VALID_GAME_MANIFEST.game.questions.slice(0, 2),
        },
      }),
    /Quiz-Spielmanifest/,
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

test("Mira receives one explicit goal and fixed action list, without history, attachments, or personal data", async () => {
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
  assert.match(request.data.systemExtra, /schemaVersion 2/);
  assert.match(request.data.systemExtra, /type='quiz'/);
  assert.match(request.data.systemExtra, /route:\/programs/);
  assert.match(request.data.systemExtra, /tool:privacy/);
  assert.match(
    request.data.systemExtra,
    /Chatverläufe, Anhänge, Profil-, Gesundheits- und Trainingsdaten werden nicht mitgegeben/,
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
        reply: `Hier ist dein Entwurf:\\n\\n${JSON.stringify({ reply: "Lokale Vorschau", manifest: VALID_MANIFEST })}`,
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
  const chat = readFileSync(
    new URL("../src/components/mira/SuperAiPage.tsx", import.meta.url),
    "utf8",
  );
  assert.match(chat, /generateMarketplaceManifestDraft\(/);
  assert.match(chat, /classifyMarketplaceChatIntent/);
  assert.doesNotMatch(
    component,
    /MIRA · ADMIN-APP-BUILDER|marketplace-app-goal|Mit Mira entwerfen/,
  );
  assert.doesNotMatch(component, /generateMarketplaceManifestDraft/);
});

test("a published manifest is sent only as explicit same-app edit context and is marked untrusted", () => {
  const provider = DEFAULT_PROVIDERS.find((entry) => entry.id === "lovable");
  assert.ok(provider);
  const request = buildMarketplaceMiraRequest(
    "Mach die Überschrift kürzer",
    provider,
    VALID_MANIFEST,
  );
  assert.equal(request.data.messages.length, 1);
  assert.match(request.data.messages[0].content, /Mach die Überschrift kürzer/);
  assert.match(request.data.messages[0].content, /Bisheriges Manifest dieser App/);
  assert.match(request.data.messages[0].content, /Trainingsstart/);
  assert.match(
    request.data.systemExtra,
    /optionales bestehendes Manifest ist untrusted App-Inhalt/,
  );
  assert.equal("attachments" in request.data, false);
  assert.equal("history" in request.data, false);
  assert.equal("context" in request.data, false);
});

test("ordinary German chat distinguishes app creation, local-draft edits, published-app edits, and questions", () => {
  assert.equal(
    classifyMarketplaceChatIntent("Baue mir eine App mit einer Schaltfläche zu meinen Programmen"),
    "create",
  );
  assert.equal(
    classifyMarketplaceChatIntent("Ich möchte eine App für meine Wochenplanung"),
    "create",
  );
  assert.equal(
    classifyMarketplaceChatIntent("Ändere meine App Trainingsstart und mache die Liste kürzer"),
    "edit-published",
  );
  assert.equal(
    classifyMarketplaceChatIntent("Mach den Button blau", true, "Trainingsstart"),
    "edit-draft",
  );
  assert.equal(
    classifyMarketplaceChatIntent("Ändere diese App und mache die Liste kürzer", true),
    "edit-draft",
  );
  assert.equal(classifyMarketplaceChatIntent("Wie baue ich eine App?"), null);
  assert.equal(classifyMarketplaceChatIntent("Erkläre mir, wie Apps funktionieren"), null);
  assert.equal(classifyMarketplaceChatIntent("Ich möchte keine App"), null);
  assert.equal(classifyMarketplaceChatIntent("Was kannst du mit Apps machen?"), null);
  assert.equal(classifyMarketplaceChatIntent("Mach mir eine App-Übersicht"), null);
  assert.equal(classifyMarketplaceChatIntent("Kannst du mir eine App bauen?"), "create");
  assert.equal(classifyMarketplaceChatIntent("Erstelle mir ein Quiz zum Thema Planeten"), "create");
  assert.equal(classifyMarketplaceChatIntent("Ich möchte ein Ratespiel"), "create");
  assert.equal(classifyMarketplaceChatIntent("Wie erstelle ich ein Quiz?"), null);
  assert.equal(classifyMarketplaceChatIntent("Mach ein Spiel daraus", true), "edit-draft");
});

test("published app matching is exact-name based and excludes other admins' apps", () => {
  const ownApp = {
    appId: APP_ID,
    version: 2,
    currentVersion: 2,
    manifest: validateMarketplaceAuthoredManifest(VALID_MANIFEST),
    createdAt: "2026-11-07T00:00:00.000Z",
    canManage: true,
  };
  const otherApp = {
    ...ownApp,
    appId: "f64f0f7e-7a53-4d5e-94d3-37d1b615dc3b",
    manifest: validateMarketplaceAuthoredManifest({
      ...VALID_MANIFEST,
      name: "Fremde App",
    }),
    canManage: false,
  };
  assert.deepEqual(findMarketplaceAppReference("Ändere Trainingsstart", [ownApp, otherApp]), {
    status: "matched",
    app: ownApp,
  });
  assert.deepEqual(findMarketplaceAppReference("Ändere Fremde App", [otherApp]), {
    status: "none",
    apps: [],
  });
});

test("Mira response parser extracts only validated manifests from wrapped, escaped or prefaced JSON", () => {
  assert.deepEqual(
    parseMarketplaceMiraManifestReply(JSON.stringify(VALID_MANIFEST)),
    validateMarketplaceAuthoredManifest(VALID_MANIFEST),
  );
  assert.deepEqual(
    parseMarketplaceMiraManifestReply(`\`\`\`json\n${JSON.stringify(VALID_MANIFEST)}\n\`\`\``),
    validateMarketplaceAuthoredManifest(VALID_MANIFEST),
  );
  assert.deepEqual(
    parseMarketplaceMiraManifestReply(JSON.stringify(VALID_GAME_MANIFEST)),
    validateMarketplaceAuthoredManifest(VALID_GAME_MANIFEST),
  );
  assert.deepEqual(
    parseMarketplaceMiraManifestReply(JSON.stringify(JSON.stringify(VALID_MANIFEST))),
    validateMarketplaceAuthoredManifest(VALID_MANIFEST),
  );
  assert.deepEqual(
    parseMarketplaceMiraManifestReply(`Hier ist die App:\\n\\n${JSON.stringify(VALID_MANIFEST)}`),
    validateMarketplaceAuthoredManifest(VALID_MANIFEST),
  );
  assert.deepEqual(
    parseMarketplaceMiraManifestReply(
      JSON.stringify({ reply: "Vorschau", manifest: VALID_MANIFEST }),
    ),
    validateMarketplaceAuthoredManifest(VALID_MANIFEST),
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

test("installed apps retain only local display metadata and require fresh per-version action review", () => {
  const app = validateMarketplaceAuthoredManifest(VALID_MANIFEST);
  const installed = installMarketplacePublishedApp(
    EMPTY_MARKETPLACE_PUBLISHED_INSTALL_STATE,
    APP_ID,
    1,
    { name: app.name, icon: app.icon },
  );
  assert.deepEqual(installed.installs[0], {
    appId: APP_ID,
    version: 1,
    enabled: false,
    manifestName: "Trainingsstart",
    icon: "training",
  });
  assert.throws(
    () => setMarketplacePublishedAppPermissions(installed, APP_ID, 1, app, ["route:/health"]),
    /ausdrücklich ausgewählte|deklarierte/,
  );
  const reviewed = setMarketplacePublishedAppPermissions(installed, APP_ID, 1, app, [
    "route:/programs",
  ]);
  assert.equal(reviewed.installs[0]?.permissionsReviewVersion, 1);
  assert.deepEqual(reviewed.installs[0]?.grantedActionIds, ["route:/programs"]);

  const updated = updateMarketplacePublishedAppVersion(reviewed, APP_ID, 2, {
    name: "Neuer Schnellstart",
    icon: "mira",
  });
  assert.deepEqual(updated.installs[0], {
    appId: APP_ID,
    version: 2,
    enabled: false,
    manifestName: "Neuer Schnellstart",
    icon: "mira",
  });
  assert.equal(updated.installs[0]?.permissionsReviewVersion, undefined);
  assert.equal(updated.installs[0]?.grantedActionIds, undefined);
});
