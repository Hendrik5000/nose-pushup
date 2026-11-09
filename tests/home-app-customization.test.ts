import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clearHomeAppName,
  EMPTY_HOME_APP_CUSTOMIZATION,
  HOME_BACKGROUND_PRESETS,
  homeAppCustomizationStorageKey,
  loadHomeAppCustomization,
  moveHomeApp,
  orderHomeAppIds,
  parseHomeAppCustomizationSettings,
  saveHomeAppCustomization,
  setHomeAppName,
  setHomeBackground,
} from "../src/lib/home-app-customization";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

test("home app preferences round-trip locally and are isolated by account", () => {
  const storage = new MemoryStorage();
  const settings = parseHomeAppCustomizationSettings({
    schemaVersion: 1,
    order: ["tools", "mira"],
    nameOverrides: { mira: "Meine Mira" },
    background: "forest",
  });

  saveHomeAppCustomization(storage, "user-a", settings);
  assert.deepEqual(loadHomeAppCustomization(storage, "user-a"), settings);
  assert.deepEqual(loadHomeAppCustomization(storage, "user-b"), EMPTY_HOME_APP_CUSTOMIZATION);
  assert.notEqual(
    homeAppCustomizationStorageKey("user-a"),
    homeAppCustomizationStorageKey("user-b"),
  );
  assert.match(homeAppCustomizationStorageKey("user-a"), /user-a/);
});

test("home app ordering only applies to currently visible apps and ignores stale IDs", () => {
  assert.deepEqual(
    orderHomeAppIds(["mira", "areas", "tools"], ["tools", "mira", "removed", "tools"]),
    ["tools", "mira", "areas"],
  );
});

test("home app movement swaps only visible neighbors and respects both ends", () => {
  const ids = ["mira", "nexus", "health"];
  const moved = moveHomeApp(EMPTY_HOME_APP_CUSTOMIZATION, ids, "nexus", -1);
  assert.deepEqual(moved.order, ["nexus", "mira", "health"]);
  assert.deepEqual(moveHomeApp(moved, ids, "nexus", -1).order, ["nexus", "mira", "health"]);
  assert.deepEqual(moveHomeApp(moved, ids, "health", 1).order, ["nexus", "mira", "health"]);
  assert.throws(
    () => moveHomeApp(EMPTY_HOME_APP_CUSTOMIZATION, ids, "mira", 0 as -1 | 1),
    /Verschieberichtung/,
  );
});

test("app names are trimmed, account-local, and reject markup, controls, or excessive length", () => {
  const named = setHomeAppName(EMPTY_HOME_APP_CUSTOMIZATION, "mira", "  Meine Mira  ");
  assert.equal(named.nameOverrides.mira, "Meine Mira");
  assert.deepEqual(clearHomeAppName(named, "mira"), EMPTY_HOME_APP_CUSTOMIZATION);
  assert.throws(() => setHomeAppName(named, "mira", ""), /leer/);
  assert.throws(() => setHomeAppName(named, "mira", "<img src=x>"), /ungültige Zeichen/);
  assert.throws(() => setHomeAppName(named, "mira", `x${"a".repeat(48)}`), /zu lang/);
  assert.throws(() => setHomeAppName(named, "../mira", "Name"), /Ungültige Alo-App/);
});

test("only a bundled background preset or the standard background can be selected", () => {
  assert.deepEqual(
    HOME_BACKGROUND_PRESETS.map(({ id }) => id),
    ["aurora", "dawn", "forest", "ocean"],
  );
  for (const preset of HOME_BACKGROUND_PRESETS) {
    assert.match(preset.background, /^radial-gradient\(/);
    assert.doesNotMatch(preset.background, /url\(|https?:|<script/i);
    assert.equal(setHomeBackground(EMPTY_HOME_APP_CUSTOMIZATION, preset.id).background, preset.id);
  }
  assert.equal(setHomeBackground(EMPTY_HOME_APP_CUSTOMIZATION, "none").background, "none");
  assert.throws(
    () => setHomeBackground(EMPTY_HOME_APP_CUSTOMIZATION, "https://example.com/bg.jpg"),
    /hintergrund/i,
  );
});

test("invalid or oversized stored settings fail closed without rewriting local data", () => {
  const storage = new MemoryStorage();
  const key = homeAppCustomizationStorageKey("user-a");
  const malformed = JSON.stringify({
    schemaVersion: 1,
    order: ["../../marketplace"],
    nameOverrides: {},
    background: "none",
  });
  storage.setItem(key, malformed);
  assert.deepEqual(loadHomeAppCustomization(storage, "user-a"), EMPTY_HOME_APP_CUSTOMIZATION);
  assert.equal(storage.getItem(key), malformed);
  storage.setItem(key, "x".repeat(20_000));
  assert.deepEqual(loadHomeAppCustomization(storage, "user-a"), EMPTY_HOME_APP_CUSTOMIZATION);
  assert.deepEqual(loadHomeAppCustomization(storage, ""), EMPTY_HOME_APP_CUSTOMIZATION);
});

test("settings parser rejects unknown fields, duplicate app IDs, and unsupported background IDs", () => {
  assert.throws(
    () => parseHomeAppCustomizationSettings({ ...EMPTY_HOME_APP_CUSTOMIZATION, extra: true }),
    /Ungültige lokale Home-Einstellungen/,
  );
  assert.throws(
    () =>
      parseHomeAppCustomizationSettings({
        ...EMPTY_HOME_APP_CUSTOMIZATION,
        order: ["mira", "mira"],
      }),
    /doppelte/,
  );
  assert.throws(
    () =>
      parseHomeAppCustomizationSettings({
        ...EMPTY_HOME_APP_CUSTOMIZATION,
        background: "not-a-preset",
      }),
    /Ungültige lokale Home-Einstellungen/,
  );
});
