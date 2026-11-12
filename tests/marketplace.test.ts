import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  EMPTY_MARKETPLACE_INSTALL_STATE,
  MARKETPLACE_CATALOG,
  describeMarketplacePermissions,
  disableMarketplacePlugin,
  enableMarketplacePlugin,
  getEnabledMarketplaceAction,
  isMarketplaceAdminAccessGranted,
  isMarketplaceAdminForUser,
  installMarketplacePlugin,
  loadMarketplaceInstallState,
  marketplaceInstallStorageKey,
  parseMarketplaceInstallState,
  removeMarketplacePlugin,
  runMarketplaceAdminAction,
  saveMarketplaceInstallState,
  validateMarketplaceManifest,
} from "../src/lib/marketplace";
import { ALO_WORKSPACE_TOOLS, HOME_OTHER_AREAS } from "../src/lib/home-app-menus";
import { PRIVATE_GAME_IDS } from "../src/lib/private-game-policy";

class MemoryStorage {
  readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

test("bundled Marketplace manifests are canonical, declarative and host-registered", () => {
  assert.equal(new Set(MARKETPLACE_CATALOG.map(({ id }) => id)).size, MARKETPLACE_CATALOG.length);
  assert.equal(MARKETPLACE_CATALOG.length, 29);

  assert.ok(Object.isFrozen(MARKETPLACE_CATALOG));
  for (const manifest of MARKETPLACE_CATALOG) {
    assert.deepEqual(validateMarketplaceManifest(manifest), manifest);
    assert.equal(typeof manifest.action, "object");
    assert.ok(Object.isFrozen(manifest));
    assert.ok(Object.isFrozen(manifest.action));
    assert.ok(Object.isFrozen(manifest.permissions));
    assert.ok(manifest.permissions.length > 0);
    assert.ok(
      describeMarketplacePermissions(manifest).every((permission) => permission.length > 20),
    );
    assert.doesNotMatch(JSON.stringify(manifest), /https?:\/\/|<script|javascript:/i);
    for (const forbiddenField of ["code", "html", "script", "url", "module", "packageUrl"]) {
      assert.equal(
        forbiddenField in manifest,
        false,
        `${manifest.id} must not carry ${forbiddenField}`,
      );
    }
  }

  assert.match(
    describeMarketplacePermissions(MARKETPLACE_CATALOG[0])[0],
    /Keine zusätzlichen Plugin-Datenrechte/,
  );
  const toolManifest = MARKETPLACE_CATALOG.find(({ action }) => action.type === "open-tool");
  assert.ok(toolManifest);
  assert.match(describeMarketplacePermissions(toolManifest)[0], /erst nach deinem Tippen/);
  const gameManifest = MARKETPLACE_CATALOG.find(({ action }) => action.type === "open-game");
  assert.ok(gameManifest);
  assert.match(describeMarketplacePermissions(gameManifest)[0], /Admin-Schutz gilt weiter/);
});

test("Marketplace covers all existing first-party app, area, tool and game registrations", () => {
  const appRoutes = [
    "/ai",
    "/chat",
    "/exercises",
    "/profile",
    "/training",
    "/admin",
    "/areas",
    "/tools",
    "/marketplace",
    "/coach",
    "/postfach",
  ];
  for (const route of appRoutes) {
    assert.ok(
      MARKETPLACE_CATALOG.some(
        (plugin) =>
          plugin.category === "app" &&
          plugin.action.type === "navigate" &&
          plugin.action.to === route,
      ),
      `missing existing Alo app route ${route}`,
    );
  }

  for (const { to, label, description } of HOME_OTHER_AREAS) {
    const area = MARKETPLACE_CATALOG.find(
      (plugin) =>
        plugin.category === "area" && plugin.action.type === "navigate" && plugin.action.to === to,
    );
    assert.ok(area, `missing registered Alo area ${to}`);
    assert.equal(area.name, label, `area label must match Alo navigation for ${to}`);
    assert.equal(
      area.description,
      description,
      `area description must match Alo navigation for ${to}`,
    );
  }

  for (const { id, label, description } of ALO_WORKSPACE_TOOLS) {
    const tool = MARKETPLACE_CATALOG.find(
      (plugin) =>
        plugin.category === "tool" &&
        plugin.action.type === "open-tool" &&
        plugin.action.toolId === id,
    );
    assert.ok(tool, `missing registered Alo tool ${id}`);
    assert.equal(tool.name, label, `tool label must match Alo navigation for ${id}`);
    assert.equal(
      tool.description,
      description,
      `tool description must match Alo navigation for ${id}`,
    );
  }

  for (const gameId of PRIVATE_GAME_IDS) {
    assert.ok(
      MARKETPLACE_CATALOG.some(
        (plugin) =>
          plugin.category === "app" &&
          plugin.action.type === "open-game" &&
          plugin.action.gameId === gameId,
      ),
      `missing existing Admin-protected game ${gameId}`,
    );
  }

  assert.equal(MARKETPLACE_CATALOG.filter(({ category }) => category === "app").length, 13);
  assert.equal(MARKETPLACE_CATALOG.filter(({ category }) => category === "area").length, 10);
  assert.equal(MARKETPLACE_CATALOG.filter(({ category }) => category === "tool").length, 6);
});

test("install, enable, disable and remove are separate explicit local state transitions", () => {
  const pluginId = MARKETPLACE_CATALOG[0].id;
  const installed = installMarketplacePlugin(EMPTY_MARKETPLACE_INSTALL_STATE, pluginId);
  assert.deepEqual(installed.installedPluginIds, [pluginId]);
  assert.deepEqual(installed.enabledPluginIds, []);
  assert.equal(getEnabledMarketplaceAction(installed, pluginId), null);
  assert.throws(
    () => enableMarketplacePlugin(EMPTY_MARKETPLACE_INSTALL_STATE, pluginId),
    /nicht installiert/,
  );

  const enabled = enableMarketplacePlugin(installed, pluginId);
  assert.deepEqual(enabled.enabledPluginIds, [pluginId]);
  assert.deepEqual(getEnabledMarketplaceAction(enabled, pluginId), MARKETPLACE_CATALOG[0].action);

  const disabled = disableMarketplacePlugin(enabled, pluginId);
  assert.deepEqual(disabled.installedPluginIds, [pluginId]);
  assert.deepEqual(disabled.enabledPluginIds, []);
  assert.equal(getEnabledMarketplaceAction(disabled, pluginId), null);

  const removed = removeMarketplacePlugin(disabled, pluginId);
  assert.deepEqual(removed, EMPTY_MARKETPLACE_INSTALL_STATE);
  assert.equal(getEnabledMarketplaceAction(removed, pluginId), null);
});

test("unknown IDs, malformed manifests, invalid actions and malformed saved states are rejected", () => {
  const canonical = MARKETPLACE_CATALOG[0];
  assert.throws(
    () => installMarketplacePlugin(EMPTY_MARKETPLACE_INSTALL_STATE, "alo-unknown"),
    /Unbekannte/,
  );
  assert.throws(
    () => installMarketplacePlugin(EMPTY_MARKETPLACE_INSTALL_STATE, "../health"),
    /Ungültige/,
  );

  assert.throws(
    () => validateMarketplaceManifest({ ...canonical, id: "alo-unlisted-plugin" }),
    /Unbekannte/,
  );
  assert.throws(
    () => validateMarketplaceManifest({ ...canonical, script: "alert(1)" }),
    /stimmt nicht/,
  );
  assert.throws(
    () => validateMarketplaceManifest({ ...canonical, permissions: ["alo.network"] }),
    /stimmt nicht/,
  );
  assert.throws(
    () =>
      validateMarketplaceManifest({
        ...canonical,
        action: { type: "navigate", to: "https://example.invalid" },
      }),
    /stimmt nicht/,
  );
  const gameManifest = MARKETPLACE_CATALOG.find(({ action }) => action.type === "open-game");
  assert.ok(gameManifest);
  assert.throws(
    () =>
      validateMarketplaceManifest({
        ...gameManifest,
        action: { type: "open-game", gameId: "unregistered-game" },
      }),
    /stimmt nicht/,
  );
  assert.throws(
    () =>
      parseMarketplaceInstallState({
        schemaVersion: 1,
        installedPluginIds: ["alo-unknown"],
        enabledPluginIds: [],
      }),
    /unbekannte Plugin-ID/,
  );
  assert.throws(
    () =>
      parseMarketplaceInstallState({
        schemaVersion: 1,
        installedPluginIds: [],
        enabledPluginIds: [canonical.id],
      }),
    /installiert sein/,
  );
  assert.throws(
    () =>
      parseMarketplaceInstallState({
        schemaVersion: 1,
        installedPluginIds: [canonical.id],
        enabledPluginIds: [],
        remotePackageUrl: "https://example.invalid/plugin.js",
      }),
    /Ungültiger lokaler Marketplace-Installationsstatus/,
  );
});

test("installation state stays local, account/backend scoped and malformed storage fails closed", () => {
  const storage = new MemoryStorage();
  const pluginId = MARKETPLACE_CATALOG[1].id;
  const saved = enableMarketplacePlugin(
    installMarketplacePlugin(EMPTY_MARKETPLACE_INSTALL_STATE, pluginId),
    pluginId,
  );

  saveMarketplaceInstallState(storage, "account-one", saved);
  assert.deepEqual(loadMarketplaceInstallState(storage, "account-one"), saved);
  assert.deepEqual(
    loadMarketplaceInstallState(storage, "account-two"),
    EMPTY_MARKETPLACE_INSTALL_STATE,
  );
  assert.notEqual(
    marketplaceInstallStorageKey("account-one"),
    marketplaceInstallStorageKey("account-two"),
  );

  const key = marketplaceInstallStorageKey("account-one");
  const malformed = JSON.stringify({
    schemaVersion: 1,
    installedPluginIds: ["alo-unknown"],
    enabledPluginIds: [],
  });
  storage.setItem(key, malformed);
  assert.deepEqual(
    loadMarketplaceInstallState(storage, "account-one"),
    EMPTY_MARKETPLACE_INSTALL_STATE,
  );
  assert.equal(
    storage.getItem(key),
    malformed,
    "invalid local data fails closed without overwriting it",
  );
});

test("failed local writes propagate without claiming a persisted installation", () => {
  const storage = new MemoryStorage();
  const installed = installMarketplacePlugin(
    EMPTY_MARKETPLACE_INSTALL_STATE,
    MARKETPLACE_CATALOG[0].id,
  );
  storage.setItem = () => {
    throw new Error("QuotaExceededError");
  };
  assert.throws(
    () => saveMarketplaceInstallState(storage, "account-one", installed),
    /QuotaExceededError/,
  );
  assert.deepEqual(
    loadMarketplaceInstallState(storage, "account-one"),
    EMPTY_MARKETPLACE_INSTALL_STATE,
  );
});

test("non-admin Marketplace action attempts fail closed without local or host side effects", () => {
  const storage = new MemoryStorage();
  const pluginId = MARKETPLACE_CATALOG[0].id;
  const installed = installMarketplacePlugin(EMPTY_MARKETPLACE_INSTALL_STATE, pluginId);
  const enabled = enableMarketplacePlugin(installed, pluginId);
  const disabled = disableMarketplacePlugin(enabled, pluginId);
  const removed = removeMarketplacePlugin(disabled, pluginId);
  let hostOpenCount = 0;

  assert.equal(isMarketplaceAdminAccessGranted(true), true);
  for (const denied of [false, undefined, null, "true", 1]) {
    assert.equal(isMarketplaceAdminAccessGranted(denied), false);
  }

  const actions = [
    () => saveMarketplaceInstallState(storage, "account-one", installed),
    () => saveMarketplaceInstallState(storage, "account-one", enabled),
    () => saveMarketplaceInstallState(storage, "account-one", disabled),
    () => saveMarketplaceInstallState(storage, "account-one", removed),
    () => {
      hostOpenCount += 1;
    },
  ];
  for (const action of actions) assert.equal(runMarketplaceAdminAction(false, action), false);
  assert.equal(storage.values.size, 0);
  assert.equal(hostOpenCount, 0);

  assert.equal(runMarketplaceAdminAction(true, actions[0]), true);
  assert.equal(storage.values.size, 1, "a verified Admin action may persist locally");
});

test("Marketplace Admin access is bound to the current account during either switch direction", () => {
  const adminA = { userId: "account-admin-a", isAdmin: true };
  const deniedB = { userId: "account-b", isAdmin: false };
  const newlyVerifiedAdminB = { userId: "account-b", isAdmin: true };

  assert.equal(isMarketplaceAdminForUser(adminA, "account-admin-a"), true);
  assert.equal(isMarketplaceAdminForUser(adminA, "account-b"), false);
  assert.equal(isMarketplaceAdminForUser(deniedB, "account-b"), false);
  assert.equal(isMarketplaceAdminForUser(deniedB, "account-admin-a"), false);
  assert.equal(isMarketplaceAdminForUser(newlyVerifiedAdminB, "account-b"), true);
  assert.equal(isMarketplaceAdminForUser(null, "account-b"), false);
});

test("Marketplace implementation has no executable plugin or network primitives", () => {
  const library = readFileSync(new URL("../src/lib/marketplace.ts", import.meta.url), "utf8");
  const route = readFileSync(
    new URL("../src/routes/_authenticated/marketplace.tsx", import.meta.url),
    "utf8",
  );
  const catalog = readFileSync(
    new URL("../src/components/marketplace/MarketplaceAppCatalog.tsx", import.meta.url),
    "utf8",
  );

  for (const source of [library, route, catalog]) {
    assert.doesNotMatch(
      source,
      /\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|\beval\s*\(|\bFunction\s*\(|dangerouslySetInnerHTML|\bimport\s*\(/,
    );
  }
  assert.doesNotMatch(route, /srcDoc|<script\b/i);
  assert.match(
    route,
    /beforeLoad:[\s\S]*?getAdminAreaAccess\(\)[\s\S]*?isMarketplaceAdminAccessGranted\([\s\S]*?redirect/,
  );
  assert.match(route, /if \(!isMarketplaceAdmin\) return null/);
  assert.match(route, /getAdminAreaAccess\(\)[\s\S]*?setAdminAccess\(\{ userId, isAdmin:/);
  assert.match(route, /isMarketplaceAdminForUser\(adminAccess, userId\)/);
  assert.match(route, /roleCheckComplete && !isMarketplaceAdmin/);
  for (const handler of ["onInstall", "onToggle", "onRemove", "onOpenPlugin"]) {
    assert.match(
      route,
      new RegExp(`const ${handler} = [\\s\\S]*?runMarketplaceAdminAction\\(isMarketplaceAdmin`),
    );
  }
  assert.doesNotMatch(
    route,
    /\.rpc\s*\(|grantAdminAccess|revokeAdminAccess|grant_global_role|revoke_global_role|list_admin_role_assignments/,
  );
  assert.match(route, /<MarketplaceContent key=\{user\.id\} userId=\{user\.id\}/);
  assert.match(route, /saveMarketplaceInstallState\(window\.localStorage, userId, next\)/);
  assert.match(route, /Änderung nicht gespeichert/);
  assert.ok(MARKETPLACE_CATALOG.every((plugin) => typeof plugin.action !== "function"));
});
