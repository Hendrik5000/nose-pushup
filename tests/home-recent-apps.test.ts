import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  forgetRecentHomeApps,
  homeDayGreeting,
  HOME_RECENT_APPS_MAX,
  homeRecentAppsStorageKey,
  loadRecentHomeAppIds,
  rememberHomeAppOpen,
} from "../src/lib/home-recent-apps";

class MemoryStorage {
  private readonly entries = new Map<string, string>();
  getItem(key: string) {
    return this.entries.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.entries.set(key, value);
  }
  removeItem(key: string) {
    this.entries.delete(key);
  }
}

test("recently opened home apps persist per account, stay fresh and capped", () => {
  const storage = new MemoryStorage();
  const now = 1_700_000_000_000;
  assert.deepEqual(loadRecentHomeAppIds(storage, "user-a", now), []);

  rememberHomeAppOpen(storage, "user-a", "mira", now);
  rememberHomeAppOpen(storage, "user-a", "marketplace", now + 1000);
  rememberHomeAppOpen(storage, "user-a", "mira", now + 2000);
  assert.deepEqual(loadRecentHomeAppIds(storage, "user-a", now + 2000), ["mira", "marketplace"]);
  assert.deepEqual(loadRecentHomeAppIds(storage, "user-b", now), []);
  assert.notEqual(homeRecentAppsStorageKey("user-a"), homeRecentAppsStorageKey("user-b"));
  assert.throws(() => homeRecentAppsStorageKey("  "));

  for (let index = 0; index < HOME_RECENT_APPS_MAX + 3; index += 1) {
    rememberHomeAppOpen(storage, "user-a", `plugin:${index}`, now + 3000 + index);
  }
  const capped = loadRecentHomeAppIds(storage, "user-a", now + 3100);
  assert.equal(capped.length, HOME_RECENT_APPS_MAX);
  assert.equal(capped[0], `plugin:${HOME_RECENT_APPS_MAX + 2}`);

  const stale = rememberHomeAppOpen(storage, "user-stale", "mira", now);
  assert.deepEqual(loadRecentHomeAppIds(storage, "user-stale", now + 1000 * 60 * 60 * 24 * 31), []);

  forgetRecentHomeApps(storage, "user-a");
  assert.deepEqual(loadRecentHomeAppIds(storage, "user-a", now + 3100), []);
  assert.deepEqual(stale, ["mira"]);
});

test("the greeting stays honest around the clock and rejects garbage", () => {
  assert.equal(homeDayGreeting(4), "Gute Nacht");
  assert.equal(homeDayGreeting(7), "Guten Morgen");
  assert.equal(homeDayGreeting(13), "Guten Tag");
  assert.equal(homeDayGreeting(21), "Guten Abend");
  assert.equal(homeDayGreeting(25), "Gute Nacht");
  assert.equal(homeDayGreeting(-3), "Guten Abend");
  assert.equal(homeDayGreeting(Number.NaN), "Guten Tag");
});

test("the home screen renders Dein Tag and the paginated launcher with real actions only", () => {
  const home = readFileSync(
    new URL("../src/routes/_authenticated/index.tsx", import.meta.url),
    "utf8",
  );
  assert.match(home, /from "@\/lib\/home-recent-apps"/);
  assert.match(home, /aria-label="Dein Tag"/);
  assert.match(home, /homeDayGreeting\(new Date\(\)\.getHours\(\)\)/);
  assert.match(home, /renderHomeGroup\("launcher", "Apps", currentHomePageTiles\)/);
  assert.match(home, /rememberAppOpen\(tile\.id\)/);
  assert.match(home, /alo-launcher-dock/);
  assert.match(home, /alo-launcher-page-dot/);
  const lib = readFileSync(new URL("../src/lib/home-recent-apps.ts", import.meta.url), "utf8");
  assert.match(lib, /alo-home-recent-apps-v1/);
  assert.match(lib, /MAX_AGE_MS/);
});
