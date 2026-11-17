import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  addHomeWidget,
  EMPTY_HOME_APP_HUB_SETTINGS,
  HOME_WIDGET_CATALOG,
  HOME_WIDGET_SIZE_CLASS_NAMES,
  HOME_WIDGET_SIZE_LABELS,
  HOME_WIDGET_SIZES,
  homeAppHubSettingsStorageKey,
  moveHomeWidget,
  parseHomeAppHubSettings,
  removeHomeWidget,
  saveHomeAppHubSettings,
  setHomeWidgetSize,
} from "@/lib/home-app-hub";

const repoRoot = resolve(import.meta.dirname, "..");
const readRepoFile = (relativePath: string) =>
  readFileSync(resolve(repoRoot, relativePath), "utf8");

class MemoryStorage {
  private readonly entries = new Map<string, string>();
  getItem(key: string) {
    return this.entries.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.entries.set(key, value);
  }
}

test("Home widgets can be added, reordered, resized, and removed with validation", () => {
  const added = addHomeWidget(EMPTY_HOME_APP_HUB_SETTINGS, "health-today");
  assert.deepEqual(added.widgetOrder, ["health-today"]);
  const second = addHomeWidget(added, "nexus-unread");
  assert.deepEqual(second.widgetOrder, ["health-today", "nexus-unread"]);
  assert.deepEqual(addHomeWidget(second, "health-today").widgetOrder, second.widgetOrder);

  const moved = moveHomeWidget(second, "health-today", 1);
  assert.deepEqual(moved.widgetOrder, ["nexus-unread", "health-today"]);
  assert.deepEqual(moveHomeWidget(moved, "health-today", 1).widgetOrder, moved.widgetOrder);
  assert.throws(() => moveHomeWidget(second, "health-today", 2 as -1), /richtung/i);

  const wide = setHomeWidgetSize(second, "health-today", "wide");
  assert.deepEqual(wide.widgetSizes, { "health-today": "wide" });
  const narrow = setHomeWidgetSize(wide, "health-today", "small");
  assert.deepEqual(narrow.widgetSizes, {});
  assert.throws(() => setHomeWidgetSize(second, "ai-status", "wide"), /nicht hinzugefügt/i);
  assert.throws(() => setHomeWidgetSize(second, "health-today", "huge"), /widget-größe/i);

  const removed = removeHomeWidget(wide, "health-today");
  assert.deepEqual(removed.widgetOrder, ["nexus-unread"]);
  assert.deepEqual(removed.widgetSizes, {});
  assert.throws(() => addHomeWidget(EMPTY_HOME_APP_HUB_SETTINGS, "made-up"), /unbekannt/i);
});

test("Widget settings reject unknown ids, duplicates, and overflow, and migrate v3 layouts loss-free", () => {
  assert.throws(
    () =>
      parseHomeAppHubSettings({
        ...EMPTY_HOME_APP_HUB_SETTINGS,
        widgetOrder: ["made-up"],
      }),
    /widget/i,
  );
  assert.throws(
    () =>
      parseHomeAppHubSettings({
        ...EMPTY_HOME_APP_HUB_SETTINGS,
        widgetOrder: ["ai-status", "ai-status"],
      }),
    /doppelt/i,
  );
  assert.throws(
    () =>
      parseHomeAppHubSettings({
        ...EMPTY_HOME_APP_HUB_SETTINGS,
        widgetSizes: { "made-up": "wide" },
      }),
    /widget-größe/i,
  );

  const migrated = parseHomeAppHubSettings({
    schemaVersion: 3,
    order: ["mira"],
    nameOverrides: {},
    background: { kind: "none" },
    favorites: ["mira"],
    collapsedGroups: [],
    tileSizes: { mira: "large" },
  });
  assert.equal(migrated.schemaVersion, 4);
  assert.deepEqual(migrated.tileSizes, { mira: "large" });
  assert.deepEqual(migrated.widgetOrder, []);
  assert.deepEqual(migrated.widgetSizes, {});

  const storage = new MemoryStorage();
  saveHomeAppHubSettings(
    storage,
    "user-a",
    addHomeWidget(EMPTY_HOME_APP_HUB_SETTINGS, "ai-status"),
  );
  const raw = storage.getItem(homeAppHubSettingsStorageKey("user-a"));
  assert.ok(raw);
  const loaded = parseHomeAppHubSettings(JSON.parse(raw));
  assert.deepEqual(loaded.widgetOrder, ["ai-status"]);
});

test("Widget catalog, sizes, and labels stay consistent", () => {
  const ids = HOME_WIDGET_CATALOG.map(({ id }) => id);
  assert.equal(new Set(ids).size, ids.length);
  for (const expected of [
    "health-today",
    "fitness-week",
    "nexus-unread",
    "ai-status",
    "installed-apps",
  ]) {
    assert.ok(ids.includes(expected), `catalog must contain ${expected}`);
  }
  for (const widget of HOME_WIDGET_CATALOG) {
    assert.ok(widget.label.length > 0);
    assert.ok(widget.description.length > 0);
  }
  assert.equal(HOME_WIDGET_SIZE_CLASS_NAMES.small, "");
  assert.equal(HOME_WIDGET_SIZE_CLASS_NAMES.wide, "col-span-2");
  for (const size of HOME_WIDGET_SIZES) {
    assert.ok(HOME_WIDGET_SIZE_LABELS[size].length > 0);
  }
});

test("Home route renders the widget section, honest empty states, and the edit panel", () => {
  const home = readRepoFile("src/routes/_authenticated/index.tsx");
  assert.match(home, /aria-label="Widgets"/);
  assert.match(home, /data-home-widget-id=\{widgetId\}/);
  assert.match(home, /HOME_WIDGET_SIZE_CLASS_NAMES\[widgetSize\]/);
  assert.match(home, /renderHomeWidget\(widgetId as HomeWidgetId\)/);
  assert.match(home, /Keine Messwerte für heute\./);
  assert.match(home, /Keine Trainingsdaten diese Woche\./);
  assert.match(home, /Unbekannter Stand\./);
  assert.match(home, /Alles gelesen\./);
  assert.match(home, /Kein KI-Anbieter aktiv\./);
  assert.match(home, /Noch keine Marketplace-Apps installiert\./);
  assert.match(home, /aria-label="Widgets anpassen"/);
  assert.match(home, /addHomeWidget\(settings, widget\.id\)/);
  assert.match(home, /removeHomeWidget\(settings, widget\.id\)/);
  assert.match(home, /moveHomeWidget\(settings, widget\.id, -1\)/);
  assert.match(home, /setHomeWidgetSize\(settings, widget\.id, nextSize\)/);
  assert.match(home, /HOME_WIDGET_SIZE_LABELS\[nextSize\]/);
  assert.match(home, /ausschließlich echte Daten aus deinen Alo-Apps/);

  const lib = readRepoFile("src/lib/home-app-hub.ts");
  assert.match(lib, /HOME_WIDGET_CATALOG = Object\.freeze/);
  assert.match(lib, /schemaVersion: 4/);
});
