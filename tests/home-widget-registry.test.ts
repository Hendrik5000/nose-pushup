import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  HOME_WIDGET_CATALOG,
  type HomeWidgetCatalogEntry,
} from "../src/lib/home-widget-registry.ts";

test("widget registry entries are unique and fully described", () => {
  const ids = HOME_WIDGET_CATALOG.map(({ id }) => id);
  assert.equal(new Set(ids).size, ids.length, "Widget-IDs müssen eindeutig sein.");
  for (const widget of HOME_WIDGET_CATALOG as readonly HomeWidgetCatalogEntry[]) {
    assert.ok(widget.label.length > 0, `Widget ${widget.id} braucht ein Label.`);
    assert.ok(widget.description.length > 0, `Widget ${widget.id} braucht eine Beschreibung.`);
    assert.ok(widget.sourceApp.length > 0, `Widget ${widget.id} braucht einen sourceApp-Bereich.`);
  }
});

test("every Alo area with home data contributes a widget", () => {
  const ids = HOME_WIDGET_CATALOG.map(({ id }) => id);
  for (const expected of [
    "health-today",
    "fitness-week",
    "daily-goal",
    "nexus-unread",
    "postfach-unread",
    "ai-status",
    "installed-apps",
  ]) {
    assert.ok(ids.includes(expected), `catalog must contain ${expected}`);
  }
  const sourceApps = new Set(HOME_WIDGET_CATALOG.map(({ sourceApp }) => sourceApp));
  for (const app of [
    "Alo Health",
    "Alo Training",
    "Nexus",
    "Postfach",
    "KI-Einstellungen",
    "Marketplace",
  ]) {
    assert.ok(sourceApps.has(app), `sourceApp ${app} fehlt im Katalog.`);
  }
});

test("home hub derives schema validation and catalog from the widget registry", () => {
  const hub = readFileSync(new URL("../src/lib/home-app-hub.ts", import.meta.url), "utf8");
  assert.match(hub, /from "\.\/home-widget-registry"/);
  assert.doesNotMatch(hub, /id: "nexus-unread"/, "Katalog nicht doppelt pflegen.");

  const home = readFileSync(
    new URL("../src/routes/_authenticated/index.tsx", import.meta.url),
    "utf8",
  );
  assert.match(home, /case "daily-goal":/);
  assert.match(home, /case "postfach-unread":/);
  assert.match(home, /usePostfach\(\)/);
  assert.match(home, /Kein Tagesziel gesetzt\./);
  assert.match(home, /Postfach nicht verfügbar\./);
});
