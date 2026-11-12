import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

const root = process.cwd();
const home = readFileSync(resolve(root, "src/routes/_authenticated/index.tsx"), "utf8");
const homeTileBuilder = home.slice(
  home.indexOf("function buildHomeHubTiles"),
  home.indexOf("function HomeAppHub"),
);
const route = readFileSync(resolve(root, "src/routes/_authenticated/games.tsx"), "utf8");
const adminFunctions = readFileSync(resolve(root, "src/lib/admin.functions.ts"), "utf8");
const gameServerFunction = readFileSync(resolve(root, "src/lib/private-game.functions.ts"), "utf8");
const accessHook = readFileSync(resolve(root, "src/lib/use-private-game-access.ts"), "utf8");

test("Home surfaces the game hub only after a server-confirmed Admin check", () => {
  assert.match(home, /getAdminAreaAccess\(\)/);
  assert.match(
    homeTileBuilder,
    /if \(canSeeAdmin\)[\s\S]*?id: "grid-defense"[\s\S]*?game: "grid-defense"[\s\S]*?id: "kupferkern"[\s\S]*?game: "kupferkern"/,
  );
  assert.match(home, /setCanSeeAdmin\(false\)/);
  assert.match(home, /\}, \[user\.id\]\)/);
  assert.match(
    adminFunctions,
    /createServerFn\(\{ method: "GET" \}\)[\s\S]*?middleware\(\[requireSupabaseAuth\]\)/,
  );
  assert.match(adminFunctions, /has_global_role/);
});

test("the route and every game-document request remain server-authorized", () => {
  assert.match(route, /createFileRoute\("\/_authenticated\/games"\)/);
  assert.match(
    route,
    /beforeLoad:[\s\S]*?getAdminAreaAccess\(\)[\s\S]*?redirect\(\{ to: "\/" \}\)/,
  );
  assert.match(route, /getPrivateGameDocument\(\{ data: \{ game: selectedGame \} \}\)/);
  assert.match(route, /usePrivateGameAccess\(userId\)/);
  assert.doesNotMatch(route, /setInterval|pollIntervalMs/);
  assert.match(gameServerFunction, /middleware\(\[requireSupabaseAuth\]\)/);
  assert.match(gameServerFunction, /has_global_role/);
  assert.match(gameServerFunction, /p_role_name: "admin"/);
  assert.match(gameServerFunction, /Cache-Control", "private, no-store/);
  assert.match(accessHook, /onAuthStateChange/);
  assert.match(accessHook, /window\.addEventListener\("focus"/);
  assert.doesNotMatch(accessHook, /setInterval|pollIntervalMs/);
});

test("both named games remain available only through the protected games route", () => {
  assert.match(route, /Grid Defense/);
  assert.match(route, /Kupferkern/);
  assert.match(route, /sandbox="allow-scripts"/);
  assert.doesNotMatch(route, /allow-same-origin|src=\{(?:frameUrl|gameUrl)\}/);
});
