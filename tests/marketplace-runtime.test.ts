import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MarketplaceManifestView } from "../src/components/marketplace/MarketplaceManifestView";
import {
  validateMarketplaceAuthoredManifest,
  type MarketplacePublishedInstallState,
} from "../src/lib/marketplace-authoring";
import {
  describeMarketplaceFunctionality,
  dispatchMarketplaceHostAction,
  executeMarketplaceAppAction,
  type MarketplaceActionDependencies,
} from "../src/lib/marketplace-runtime";
import { MARKETPLACE_AUTHOR_ACTIONS } from "../src/lib/marketplace";

const appId = "11111111-1111-4111-8111-111111111111";
const actionIds = ["route:/ai", "route:/programs", "tool:today", "route:/tools"];
const manifest = validateMarketplaceAuthoredManifest({
  schemaVersion: 1,
  name: "Eigene App 1",
  description: "Schnellzugriff für Mira und Training.",
  icon: "hub",
  blocks: actionIds.map((actionId, index) => ({
    type: "action",
    label: ["Mira fragen", "Trainingsplan", "Tagesübersicht", "Werkzeuge"][index],
    actionId,
  })),
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function harness() {
  let current = true;
  let installs: MarketplacePublishedInstallState = {
    schemaVersion: 1,
    installs: [
      {
        appId,
        version: 1,
        enabled: true,
        permissionsReviewVersion: 1,
        grantedActionIds: actionIds,
      },
    ],
  };
  const events: string[] = [];
  const dependencies: MarketplaceActionDependencies = {
    isCurrent: () => current,
    checkAdmin: async () => true,
    loadInstalls: () => installs,
    getVersion: async () => ({ appId, version: 1, manifest }),
    execute: (action) =>
      dispatchMarketplaceHostAction(action, {
        navigate: async (to, game) => {
          events.push(`navigate:${to}${game ? `:${game}` : ""}`);
        },
        openTool: (tool) => events.push(`tool:${tool}`),
        close: () => events.push("close"),
      }),
  };
  return {
    dependencies,
    events,
    cancel: () => {
      current = false;
    },
    revoke: () => {
      installs = { schemaVersion: 1, installs: [] };
    },
  };
}
for (const [actionId, expected] of [
  ["route:/ai", ["navigate:/ai", "close"]],
  ["route:/programs", ["navigate:/programs", "close"]],
  ["tool:today", ["close", "tool:today"]],
  ["route:/tools", ["navigate:/tools", "close"]],
] as const) {
  test(`installed screenshot app executes registered ${actionId} after verification`, async () => {
    const h = harness();
    await executeMarketplaceAppAction({ appId, version: 1, actionId }, h.dependencies);
    assert.deepEqual(h.events, expected);
  });
}

test("non-boolean admin results never authorize an app action", async () => {
  for (const access of [false, "true", null, { isAdmin: true }]) {
    const h = harness();
    h.dependencies.checkAdmin = async () => access;
    await assert.rejects(
      executeMarketplaceAppAction({ appId, version: 1, actionId: actionIds[0] }, h.dependencies),
      /Admin-Zugriff/,
    );
    assert.deepEqual(h.events, []);
  }
});
for (const nextAccount of ["another admin", "non-admin"]) {
  test(`account switch to ${nextAccount} during admin verification cancels the pending launch`, async () => {
    const h = harness();
    const admin = deferred<unknown>();
    h.dependencies.checkAdmin = () => admin.promise;
    const launch = executeMarketplaceAppAction(
      { appId, version: 1, actionId: actionIds[0] },
      h.dependencies,
    );
    h.cancel();
    admin.resolve(true);
    await assert.rejects(launch, /Konto oder App geändert/);
    assert.deepEqual(h.events, []);
  });
}

test("closing or changing the viewer during version verification cancels the pending launch", async () => {
  const h = harness();
  const version = deferred<Awaited<ReturnType<MarketplaceActionDependencies["getVersion"]>>>();
  const reached = deferred<void>();
  h.dependencies.getVersion = () => {
    reached.resolve();
    return version.promise;
  };
  const launch = executeMarketplaceAppAction(
    { appId, version: 1, actionId: actionIds[0] },
    h.dependencies,
  );
  await reached.promise;
  h.cancel();
  version.resolve({ appId, version: 1, manifest });
  await assert.rejects(launch, /Konto oder App geändert/);
  assert.deepEqual(h.events, []);
});

test("a local revocation during version verification is checked again before dispatch", async () => {
  const h = harness();
  h.dependencies.getVersion = async () => {
    h.revoke();
    return { appId, version: 1, manifest };
  };
  await assert.rejects(
    executeMarketplaceAppAction({ appId, version: 1, actionId: actionIds[0] }, h.dependencies),
    /Freigabe hat sich geändert/,
  );
  assert.deepEqual(h.events, []);
});

test("missing local install/grant blocks server version lookup and dispatch", async () => {
  const h = harness();
  h.revoke();
  let reads = 0;
  h.dependencies.getVersion = async () => {
    reads++;
    return { appId, version: 1, manifest };
  };
  await assert.rejects(
    executeMarketplaceAppAction({ appId, version: 1, actionId: actionIds[0] }, h.dependencies),
    /nicht freigegeben/,
  );
  assert.equal(reads, 0);
  assert.deepEqual(h.events, []);
});

test("different published version or undeclared action never dispatches", async () => {
  for (const checked of [
    { appId, version: 2, manifest },
    { appId: "22222222-2222-4222-8222-222222222222", version: 1, manifest },
    {
      appId,
      version: 1,
      manifest: validateMarketplaceAuthoredManifest({
        ...manifest,
        blocks: [{ type: "action", label: "Werkzeuge", actionId: "route:/tools" }],
      }),
    },
  ]) {
    const h = harness();
    h.dependencies.getVersion = async () => checked;
    await assert.rejects(
      executeMarketplaceAppAction({ appId, version: 1, actionId: actionIds[0] }, h.dependencies),
    );
    assert.deepEqual(h.events, []);
  }
});

test("async route failure is propagated and keeps the installed viewer open", async () => {
  const events: string[] = [];
  await assert.rejects(
    dispatchMarketplaceHostAction(
      { type: "navigate", to: "/ai" },
      {
        navigate: async () => {
          throw new Error("Navigation fehlgeschlagen");
        },
        openTool: () => events.push("tool"),
        close: () => events.push("close"),
      },
    ),
    /Navigation fehlgeschlagen/,
  );
  assert.deepEqual(events, []);
});

test("registered game actions keep the protected games route and exact game id", async () => {
  const game = MARKETPLACE_AUTHOR_ACTIONS.find(
    (entry) => entry.action.type === "open-game",
  )!.action;
  assert.equal(game.type, "open-game");
  const events: string[] = [];
  await dispatchMarketplaceHostAction(game, {
    navigate: async (to, id) => {
      events.push(`${to}:${id}`);
    },
    close: () => events.push("close"),
    openTool: () => assert.fail("not a tool"),
  });
  assert.deepEqual(events, [`/games:${game.gameId}`, "close"]);
});

test("functionality labels distinguish a launcher from a genuinely interactive quiz", () => {
  assert.equal(describeMarketplaceFunctionality(manifest).label, "Alo-Schnellzugriff");
  assert.match(describeMarketplaceFunctionality(manifest).detail, /4 verknüpfte Alo-Ziele/);
  assert.match(describeMarketplaceFunctionality(manifest).detail, /keine eigenen Formulare/);
  assert.equal(
    describeMarketplaceFunctionality({ blocks: [], game: { type: "quiz" } }).label,
    "Spielbares Quiz",
  );
});

test("rendered installed app has four usable action rows; missing permissions lead to review, not execution", () => {
  const html = renderToStaticMarkup(
    createElement(MarketplaceManifestView, {
      manifest,
      canRunActions: true,
      allowedActionIds: actionIds,
      onAction: () => undefined,
    }),
  );
  assert.equal((html.match(/<button\b/g) ?? []).length, 4);
  assert.doesNotMatch(html, /disabled=""/);
  const ungranted = renderToStaticMarkup(
    createElement(MarketplaceManifestView, {
      manifest,
      canRunActions: true,
      allowedActionIds: [],
      onAction: () => undefined,
      onRequestPermission: () => undefined,
    }),
  );
  assert.equal((ungranted.match(/Zugriff auswählen/g) ?? []).length, 4);
  assert.doesNotMatch(ungranted, /disabled=""/);
  const preview = renderToStaticMarkup(
    createElement(MarketplaceManifestView, {
      manifest,
      preview: true,
      canRunActions: true,
      onAction: () => assert.fail("preview"),
    }),
  );
  assert.equal((preview.match(/disabled=""/g) ?? []).length, 4);
});

test("viewer binds async work to live scope and keeps recoverable action errors separate from load errors", () => {
  const source = readFileSync(
    new URL("../src/components/marketplace/MarketplacePublishedAppViewer.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /currentScope\.current = scope/);
  assert.match(source, /loadedScope === scope/);
  assert.match(source, /launchSequence\.current === sequence/);
  assert.match(source, /actionInFlight\.current/);
  assert.match(source, /executeMarketplaceAppAction/);
  assert.match(source, /onRequestPermission=\{openPermissionReview\}/);
  assert.match(source, /Erneut prüfen/);
  assert.match(source, /setActionError\(\s*messageFrom/);
  assert.match(source, /<fieldset disabled=\{savingPermissions\}/);
  assert.doesNotMatch(source, /manifest &&.*!actionError/);
});
