import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");
const readRepoFile = (relativePath: string) =>
  readFileSync(resolve(repoRoot, relativePath), "utf8");

test("home start reads profile and daily stats through one shared cache", () => {
  const hook = readRepoFile("src/hooks/useHomeDayData.ts");
  const notifications = readRepoFile("src/hooks/useNotifications.ts");
  assert.match(hook, /alo-home-profile:/);
  assert.match(notifications, /alo-home-profile:/);
  assert.match(hook, /alo-home-daily:/);
  assert.match(notifications, /alo-home-daily:/);
  for (const source of [hook, notifications]) {
    assert.match(source, /HOME_DATA_CACHE_TTL_MS/);
  }
});

test("home route file stays free of direct profile queries", () => {
  const home = readRepoFile("src/routes/_authenticated/index.tsx");
  assert.doesNotMatch(home, /\.from\("profiles"\)/, "Profil-Ladung gehört in src/hooks/.");
  assert.match(home, /useHomeDayData\(user\.id, \{/);
  for (const forbidden of ['from("workouts")', 'from("health_entries")', 'from("daily_stats")']) {
    assert.doesNotMatch(home, new RegExp(forbidden.replace(/\(/g, "\\(").replace(/\)/g, "\\)")));
  }
});
