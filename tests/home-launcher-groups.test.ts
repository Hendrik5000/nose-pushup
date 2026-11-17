import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  EMPTY_HOME_APP_HUB_SETTINGS,
  parseHomeAppHubSettings,
  toggleHomeAppFavorite,
  toggleHomeAppGroupCollapsed,
} from "@/lib/home-app-hub";

test("home settings schema v4 keeps v1 payloads and migrates them without losing order", () => {
  const v1 = {
    schemaVersion: 1,
    order: ["mira", "training"],
    nameOverrides: { mira: "Meine Mira" },
    background: { kind: "none" },
  };
  const migrated = parseHomeAppHubSettings(v1);
  assert.equal(migrated.schemaVersion, 4);
  assert.deepEqual(migrated.order, ["mira", "training"]);
  assert.equal(migrated.nameOverrides.mira, "Meine Mira");
  assert.deepEqual(migrated.favorites, []);
  assert.deepEqual(migrated.collapsedGroups, []);
  assert.deepEqual(migrated.tileSizes, {});
});

test("favorites can be toggled and stay bounded, deterministic, and account-local", () => {
  const base = parseHomeAppHubSettings({
    ...EMPTY_HOME_APP_HUB_SETTINGS,
    background: { kind: "none" },
  });
  const added = toggleHomeAppFavorite(base, "mira");
  assert.deepEqual(added.favorites, ["mira"]);
  const removed = toggleHomeAppFavorite(added, "mira");
  assert.deepEqual(removed.favorites, []);
  assert.throws(() => toggleHomeAppFavorite(base, "marketplace:../../route"));
});

test("home groups can be collapsed and expanded", () => {
  const base = parseHomeAppHubSettings({
    ...EMPTY_HOME_APP_HUB_SETTINGS,
    background: { kind: "none" },
  });
  const collapsed = toggleHomeAppGroupCollapsed(base, "intelligence");
  assert.deepEqual(collapsed.collapsedGroups, ["intelligence"]);
  const expanded = toggleHomeAppGroupCollapsed(collapsed, "intelligence");
  assert.deepEqual(expanded.collapsedGroups, []);
});

test("the home launcher groups apps into task areas instead of one flat grid", () => {
  const root = process.cwd();
  const route = readFileSync(resolve(root, "src/routes/_authenticated/index.tsx"), "utf8");
  assert.match(route, /HOME_APP_GROUPS = Object\.freeze\(/);
  for (const label of [
    "Alo Intelligence",
    "Fitness & Sport",
    "Kommunikation & Community",
    "Werkzeuge & System",
    "Unterhaltung & Erweiterungen",
    "Meine Apps",
  ]) {
    assert.match(route, new RegExp(label));
  }
  assert.match(route, /homeTileGroupId/);
  assert.match(route, /renderHomeGroup\("favorites", "Favoriten", favoriteTiles\)/);
  assert.match(route, /aria-expanded=\{!collapsed\}/);
  assert.match(route, /toggleHomeAppGroupCollapsed\(settings, groupId\)/);
});

test("the launcher keeps the flat drag grid for edit mode and grouped view otherwise", () => {
  const root = process.cwd();
  const route = readFileSync(resolve(root, "src/routes/_authenticated/index.tsx"), "utf8");
  assert.match(route, /\{isEditingHub \? \(/);
  assert.match(route, /onPointerMoveCapture=\{moveHomeTileDrag\}/);
  assert.match(route, /renderHomeGroup\(section\.id, section\.label, section\.tiles\)/);
});

test("the app action menu can add and remove favorites", () => {
  const root = process.cwd();
  const route = readFileSync(resolve(root, "src/routes/_authenticated/index.tsx"), "utf8");
  assert.match(route, /toggleHomeAppFavorite\(settings, activeActionTile\.id\)/);
  assert.match(route, /Zu Favoriten hinzufügen/);
  assert.match(route, /Aus Favoriten entfernen/);
});
