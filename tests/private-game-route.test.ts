import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

const root = process.cwd();
const route = readFileSync(resolve(root, "src/routes/_authenticated/games.tsx"), "utf8");
const serverFunction = readFileSync(resolve(root, "src/lib/private-game.functions.ts"), "utf8");
const accessPolicy = readFileSync(resolve(root, "src/lib/private-game-access-policy.ts"), "utf8");
const gridDefense = readFileSync(resolve(root, "private-game-preview/grid-defense.html"), "utf8");
const kupferkern = readFileSync(resolve(root, "private-game-preview/kupferkern.html"), "utf8");

test("direct app-route navigation is guarded by the server-side Admin check", () => {
  assert.match(route, /createFileRoute\("\/_authenticated\/games"\)/);
  assert.match(
    route,
    /beforeLoad:[\s\S]*?getAdminAreaAccess\(\)[\s\S]*?redirect\(\{ to: "\/" \}\)/,
  );
  assert.match(route, /getAdminAreaAccess/);
  assert.match(route, /AloHomeLink/);
  assert.doesNotMatch(route, /import\s*\{\s*KupferkernGame\s*\}/);
});

test("the direct document endpoint authenticates, validates game ids and checks the DB role", () => {
  assert.match(serverFunction, /createServerFn\(\{ method: "POST" \}\)/);
  assert.match(serverFunction, /\.middleware\(\[requireSupabaseAuth\]\)/);
  assert.match(serverFunction, /\.validator\([\s\S]*?gameRequestSchema\.parse\(value\)/);
  assert.match(serverFunction, /z\.enum\(PRIVATE_GAME_IDS\)/);
  assert.match(serverFunction, /setResponseHeader\("Cache-Control", "private, no-store"\)/);
  assert.match(serverFunction, /withAdminGameAccess\(/);
  assert.match(serverFunction, /has_global_role/);
  assert.match(serverFunction, /p_role_name: "admin"/);
  assert.match(serverFunction, /grid-defense\.html\?raw/);
  assert.match(serverFunction, /kupferkern\.html\?raw/);
});

test("the iframe receives protected content only through sandboxed srcDoc, not a public URL", () => {
  assert.match(route, /getPrivateGameDocument\(\{ data: \{ game: selectedGame \} \}\)/);
  assert.match(route, /<GameFrame game=\{selectedGame\} document=\{currentDocument\} \/>/);
  assert.match(route, /srcDoc=\{document\}/);
  assert.match(route, /sandbox="allow-scripts"/);
  assert.doesNotMatch(route, /allow-same-origin|VITE_PRIVATE_GAME_PREVIEW_URL|127\.0\.0\.1/);
  assert.doesNotMatch(route, /src=\{(?:frameUrl|gameUrl)\}/);
  assert.match(route, /usePrivateGameAccess\(userId, 5_000\)/);
  assert.match(route, /current\.userId === requestUserId/);
  assert.match(route, /current\.revision === requestRevision/);
  assert.match(
    route,
    /isCurrentPrivateGameDocument\(currentLoad, userId, selectedGame, access\.state\)/,
  );
  assert.match(accessPolicy, /lease\.revision === accessState\.revision/);
  assert.match(gridDefense, /Content-Security-Policy/);
  assert.match(kupferkern, /Content-Security-Policy/);
});

test("neither standalone game document is placed in the public static directory", () => {
  for (const filename of ["grid-defense.html", "kupferkern.html"]) {
    assert.equal(existsSync(resolve(root, "public", filename)), false);
  }
  assert.match(gridDefense, /grid-defense-server-only-v1/);
  assert.match(kupferkern, /kupferkern-server-only-v1/);
});
