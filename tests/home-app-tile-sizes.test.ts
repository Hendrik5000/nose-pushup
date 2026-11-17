import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  EMPTY_HOME_APP_HUB_SETTINGS,
  HOME_APP_TILE_SIZE_CLASS_NAMES,
  HOME_APP_TILE_SIZE_LABELS,
  HOME_APP_TILE_SIZES,
  forgetHomeAppPersonalization,
  homeAppHubSettingsStorageKey,
  loadHomeAppHubSettings,
  parseHomeAppHubSettings,
  saveHomeAppHubSettings,
  setHomeAppTileSize,
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

test("Tile sizes round-trip through the settings schema and migrate older layouts loss-free", () => {
  const sized = setHomeAppTileSize(EMPTY_HOME_APP_HUB_SETTINGS, "mira", "large");
  assert.equal(sized.tileSizes.mira, "large");
  const storage = new MemoryStorage();
  saveHomeAppHubSettings(storage, "user-a", sized);
  assert.deepEqual(loadHomeAppHubSettings(storage, "user-a").tileSizes, { mira: "large" });

  const migrated = parseHomeAppHubSettings({
    schemaVersion: 2,
    order: ["mira"],
    nameOverrides: {},
    background: { kind: "none" },
    favorites: ["mira"],
    collapsedGroups: ["fitness"],
  });
  assert.equal(migrated.schemaVersion, 4);
  assert.deepEqual(migrated.tileSizes, {});
  assert.deepEqual(migrated.favorites, ["mira"]);

  const legacy = parseHomeAppHubSettings({
    schemaVersion: 1,
    order: [],
    nameOverrides: {},
    background: { kind: "preset", presetId: "ocean" },
  });
  assert.equal(legacy.schemaVersion, 4);
  assert.deepEqual(legacy.tileSizes, {});
});

test("Tile size changes stay validated and small is the stored-as-absent default", () => {
  const medium = setHomeAppTileSize(EMPTY_HOME_APP_HUB_SETTINGS, "nexus", "medium");
  assert.deepEqual(medium.tileSizes, { nexus: "medium" });
  const reset = setHomeAppTileSize(medium, "nexus", "small");
  assert.deepEqual(reset.tileSizes, {});
  assert.throws(
    () => setHomeAppTileSize(EMPTY_HOME_APP_HUB_SETTINGS, "nexus", "huge"),
    /kachelgröße/i,
  );
  assert.throws(
    () => setHomeAppTileSize(EMPTY_HOME_APP_HUB_SETTINGS, "not an app", "large"),
    /alo-app/i,
  );
  assert.throws(
    () =>
      parseHomeAppHubSettings({
        ...EMPTY_HOME_APP_HUB_SETTINGS,
        tileSizes: { nexus: "gigantic" },
      }),
    /kachelgröße/i,
  );
  const forgotten = forgetHomeAppPersonalization(
    setHomeAppTileSize(EMPTY_HOME_APP_HUB_SETTINGS, "mira", "large"),
    "mira",
  );
  assert.deepEqual(forgotten.tileSizes, {});
});

test("Tile size class names and labels cover every size", () => {
  for (const size of HOME_APP_TILE_SIZES) {
    assert.equal(typeof HOME_APP_TILE_SIZE_CLASS_NAMES[size], "string");
    assert.ok(HOME_APP_TILE_SIZE_LABELS[size].length > 0);
  }
  assert.equal(HOME_APP_TILE_SIZE_CLASS_NAMES.medium, "col-span-2");
  assert.equal(HOME_APP_TILE_SIZE_CLASS_NAMES.large, "col-span-2 row-span-2");
  assert.equal(HOME_APP_TILE_SIZE_CLASS_NAMES.small, "");
});

test("Home hub renders tile sizes in both grids, the action menu, and the stylesheet", () => {
  const home = readRepoFile("src/routes/_authenticated/index.tsx");
  assert.match(home, /data-home-tile-size=\{tileSize\}/);
  assert.match(home, /data-home-tile-size=\{editTileSize\}/);
  assert.match(home, /HOME_APP_TILE_SIZE_CLASS_NAMES\[tileSize\]/);
  assert.match(home, /HOME_APP_TILE_SIZE_CLASS_NAMES\[editTileSize\]/);
  assert.match(home, /grid-flow-row-dense/);
  assert.match(home, /setHomeAppTileSize\(settings, activeActionTile\.id, size\)/);
  assert.match(home, /HOME_APP_TILE_SIZE_LABELS\[size\]/);
  assert.match(home, /Kachelgröße konnte nicht gespeichert werden\./);
  assert.match(home, /large \? "max-w-\[160px\]" : "max-w-\[96px\]"/);
  assert.match(home, /large\?: boolean/);

  const styles = readRepoFile("src/styles.css");
  assert.match(
    styles,
    /html\[data-design-style\]\s*\.alo-tablet-home-apps\s*>\s*\[data-home-tile-size="large"\]\s*>\s*:is\(a, button, div\)\s*>\s*span:first-child\s*\{\s*max-width: 160px;/,
  );

  const lib = readRepoFile("src/lib/home-app-hub.ts");
  assert.match(lib, /schemaVersion: 4/);
  assert.match(lib, /schemaVersion === 3/);
  assert.match(lib, /HOME_APP_TILE_SIZE_SET\.has/);
});
