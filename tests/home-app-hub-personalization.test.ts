import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  EMPTY_HOME_APP_HUB_SETTINGS,
  HOME_BACKGROUND_MAX_OUTPUT_DIMENSION,
  HOME_BACKGROUND_MAX_UPLOAD_BYTES,
  HOME_BACKGROUND_PRESETS,
  HOME_DEFAULT_BACKGROUND,
  clearHomeAppName,
  forgetHomeAppPersonalization,
  homeAppHubSettingsStorageKey,
  loadHomeAppHubSettings,
  moveHomeApp,
  moveHomeAppRelative,
  orderHomeAppIds,
  parseHomeAppHubSettings,
  planHomeBackgroundImage,
  readHomeBackgroundImageDimensions,
  saveHomeAppHubSettings,
  setHomeAppName,
  setHomeBackground,
} from "@/lib/home-app-hub";

class MemoryStorage {
  private readonly entries = new Map<string, string>();
  getItem(key: string) {
    return this.entries.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.entries.set(key, value);
  }
}

const installedIds = ["mira", "marketplace:2e8c4f90-071f-4ba4-b294-d0b8aa412404", "training"];

test("Home app order and per-tile names persist locally and remain account scoped", () => {
  const storage = new MemoryStorage();
  const marketplaceId = installedIds[1]!;
  const custom = setHomeAppName(EMPTY_HOME_APP_HUB_SETTINGS, marketplaceId, "Mein Schnellstart");
  const reordered = moveHomeApp(custom, installedIds, "training", -1);
  saveHomeAppHubSettings(storage, "user-a", reordered);

  assert.deepEqual(loadHomeAppHubSettings(storage, "user-a"), reordered);
  assert.deepEqual(loadHomeAppHubSettings(storage, "user-b"), EMPTY_HOME_APP_HUB_SETTINGS);
  assert.notEqual(homeAppHubSettingsStorageKey("user-a"), homeAppHubSettingsStorageKey("user-b"));
  assert.deepEqual(orderHomeAppIds(installedIds, reordered.order), [
    "mira",
    "training",
    marketplaceId,
  ]);
  assert.equal(reordered.nameOverrides[marketplaceId], "Mein Schnellstart");
});

test("Home order ignores unknown saved IDs and supports accessible boundary-safe moves", () => {
  const state = parseHomeAppHubSettings({
    schemaVersion: 1,
    order: ["removed-app", "training", "mira"],
    nameOverrides: {},
    background: { kind: "preset", presetId: "aurora" },
  });
  assert.deepEqual(
    orderHomeAppIds(
      ["mira", "training", "marketplace:2e8c4f90-071f-4ba4-b294-d0b8aa412404"],
      state.order,
    ),
    ["training", "mira", "marketplace:2e8c4f90-071f-4ba4-b294-d0b8aa412404"],
  );
  assert.deepEqual(moveHomeApp(state, ["mira", "training"], "mira", -1).order, [
    "mira",
    "training",
  ]);
  assert.deepEqual(moveHomeApp(state, ["mira", "training"], "mira", 1).order, state.order);
  assert.throws(() => moveHomeApp(state, ["mira"], "mira", 2 as -1), /richtung/i);
});

test("Home drag reordering is local, deterministic, and ignores missing drop targets", () => {
  const marketplaceId = installedIds[1]!;
  const reordered = moveHomeAppRelative(
    EMPTY_HOME_APP_HUB_SETTINGS,
    installedIds,
    marketplaceId,
    "mira",
    "before",
  );
  assert.deepEqual(reordered.order, [marketplaceId, "mira", "training"]);
  assert.deepEqual(
    moveHomeAppRelative(reordered, installedIds, "training", marketplaceId, "before").order,
    ["training", marketplaceId, "mira"],
  );
  assert.deepEqual(
    moveHomeAppRelative(EMPTY_HOME_APP_HUB_SETTINGS, installedIds, "mira", "training", "after")
      .order,
    [marketplaceId, "training", "mira"],
  );
  assert.deepEqual(
    moveHomeAppRelative(reordered, installedIds, "missing-app", "mira", "before"),
    reordered,
  );
});

test("locally uninstalling a tile clears only that tile's name/order preferences", () => {
  const marketplaceId = installedIds[1]!;
  const customized = setHomeAppName(
    moveHomeAppRelative(EMPTY_HOME_APP_HUB_SETTINGS, installedIds, marketplaceId, "mira", "before"),
    marketplaceId,
    "Mein Spiel",
  );
  const removed = forgetHomeAppPersonalization(customized, marketplaceId);

  assert.deepEqual(removed.order, ["mira", "training"]);
  assert.equal(removed.nameOverrides[marketplaceId], undefined);
  assert.deepEqual(removed.background, customized.background);
  assert.throws(() => forgetHomeAppPersonalization(customized, "not/a/route"), /Ungültige Alo-App/);
});

test("home app aliases are bounded, text-only local labels and can be reset", () => {
  const renamed = setHomeAppName(EMPTY_HOME_APP_HUB_SETTINGS, "mira", "Meine Mira");
  assert.equal(clearHomeAppName(renamed, "mira").nameOverrides.mira, undefined);
  assert.throws(() => setHomeAppName(renamed, "mira", "<img src=x>"), /ungültig/);
  assert.throws(() => setHomeAppName(renamed, "mira", "x".repeat(49)), /ungültig/);
  assert.throws(() => setHomeAppName(renamed, "not/a/route", "Mira"), /Ungültige Alo-App/);
});

test("home backgrounds accept only bundled presets or a local custom-image reference", () => {
  assert.deepEqual(EMPTY_HOME_APP_HUB_SETTINGS.background, { kind: "none" });
  assert.deepEqual(
    setHomeBackground(EMPTY_HOME_APP_HUB_SETTINGS, HOME_DEFAULT_BACKGROUND).background,
    {
      kind: "none",
    },
  );
  const selected = setHomeBackground(EMPTY_HOME_APP_HUB_SETTINGS, {
    kind: "preset",
    presetId: "forest",
  });
  assert.deepEqual(selected.background, { kind: "preset", presetId: "forest" });
  assert.deepEqual(setHomeBackground(selected, { kind: "custom" }).background, { kind: "custom" });
  assert.throws(
    () => setHomeBackground(selected, { kind: "preset", presetId: "https://example.com/a.jpg" }),
    /Hintergrund/,
  );

  for (const preset of HOME_BACKGROUND_PRESETS) {
    const path = resolve(process.cwd(), `public${preset.src}`);
    assert.ok(existsSync(path), `${preset.id} preset asset should exist`);
    const svg = readFileSync(path, "utf8");
    assert.match(svg, /<svg[\s>]/);
    assert.doesNotMatch(svg, /<script|(?:href|src)=["']https?:/i);
  }
});

test("custom home images are raster-only, resized, pixel bounded, and output capped", () => {
  const plan = planHomeBackgroundImage("image/jpeg", 300_000, 4_000, 2_000);
  assert.deepEqual(plan, {
    width: HOME_BACKGROUND_MAX_OUTPUT_DIMENSION,
    height: 960,
    mimeType: "image/webp",
    quality: 0.82,
  });
  assert.deepEqual(planHomeBackgroundImage("image/png", 10, 500, 1_000), {
    width: 500,
    height: 1_000,
    mimeType: "image/webp",
    quality: 0.82,
  });
  assert.throws(() => planHomeBackgroundImage("image/svg+xml", 100, 100, 100), /SVG-Dateien/);
  assert.throws(
    () => planHomeBackgroundImage("image/png", HOME_BACKGROUND_MAX_UPLOAD_BYTES + 1, 100, 100),
    /10 MB/,
  );
  assert.throws(() => planHomeBackgroundImage("image/png", 100, 8_001, 1), /auflösung/i);
  assert.throws(() => planHomeBackgroundImage("image/png", 100, 8_000, 4_000), /auflösung/i);
});

test("raster image dimensions are validated from PNG, JPEG, and WebP headers before decode", () => {
  const writeUint32BE = (bytes: Uint8Array, offset: number, value: number) => {
    bytes[offset] = Math.floor(value / 0x1000000) & 0xff;
    bytes[offset + 1] = Math.floor(value / 0x10000) & 0xff;
    bytes[offset + 2] = Math.floor(value / 0x100) & 0xff;
    bytes[offset + 3] = value & 0xff;
  };

  const png = new Uint8Array(24);
  png.set([137, 80, 78, 71, 13, 10, 26, 10], 0);
  png.set([73, 72, 68, 82], 12);
  writeUint32BE(png, 16, 3_000);
  writeUint32BE(png, 20, 2_000);
  assert.deepEqual(readHomeBackgroundImageDimensions("image/png", png), {
    width: 3_000,
    height: 2_000,
  });

  const jpeg = Uint8Array.from([
    0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x07, 0xd0, 0x0b, 0xb8, 0x03, 0x01, 0x11, 0x00, 0x02,
    0x11, 0x00, 0x03, 0x11, 0x00, 0xff, 0xd9,
  ]);
  assert.deepEqual(readHomeBackgroundImageDimensions("image/jpeg", jpeg), {
    width: 3_000,
    height: 2_000,
  });

  const webp = new Uint8Array(30);
  webp.set([82, 73, 70, 70], 0);
  webp.set([87, 69, 66, 80], 8);
  webp.set([86, 80, 56, 88], 12);
  webp[24] = 0x9f;
  webp[25] = 0x0f;
  webp[27] = 0xcf;
  webp[28] = 0x07;
  assert.deepEqual(readHomeBackgroundImageDimensions("image/webp", webp), {
    width: 4_000,
    height: 2_000,
  });

  writeUint32BE(png, 16, 8_001);
  assert.throws(() => readHomeBackgroundImageDimensions("image/png", png), /auflösung/i);
  assert.throws(() => readHomeBackgroundImageDimensions("image/png", new Uint8Array(24)), /sicher/);

  const source = readFileSync(resolve(process.cwd(), "src/lib/home-app-hub.ts"), "utf8");
  assert.ok(
    source.indexOf("readHomeBackgroundImageDimensions(file.type, bytes)") <
      source.indexOf("createImageBitmap(file, {"),
    "header and pixel limits must be checked before decoding",
  );
  assert.match(source, /resizeWidth: plan\.width[\s\S]*resizeHeight: plan\.height/);
});

test("malformed or oversized Home settings fail closed without rewriting storage", () => {
  const storage = new MemoryStorage();
  const key = homeAppHubSettingsStorageKey("user-a");
  const malformed = JSON.stringify({
    schemaVersion: 1,
    order: ["marketplace:../../route"],
    nameOverrides: {},
    background: { kind: "custom" },
  });
  storage.setItem(key, malformed);
  assert.deepEqual(loadHomeAppHubSettings(storage, "user-a"), EMPTY_HOME_APP_HUB_SETTINGS);
  assert.equal(storage.getItem(key), malformed);
});
