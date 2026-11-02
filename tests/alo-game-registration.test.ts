import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

const home = readFileSync(resolve(process.cwd(), "src/routes/_authenticated/index.tsx"), "utf8");
const route = readFileSync(resolve(process.cwd(), "src/routes/_authenticated/games.tsx"), "utf8");
const accessHook = readFileSync(
  resolve(process.cwd(), "src/lib/use-private-game-access.ts"),
  "utf8",
);

test("Home binds game tiles to the authenticated route identity and fail-closed access hook", () => {
  assert.match(home, /const \{ user \} = Route\.useRouteContext\(\)/);
  assert.match(home, /userId=\{user\.id\}/);
  assert.match(home, /usePrivateGameAccess\(userId, 5_000\)/);
  assert.match(accessHook, /onAuthStateChange/);
  assert.match(accessHook, /SIGNED_IN[\s\S]*SIGNED_OUT[\s\S]*USER_UPDATED/);
  assert.match(accessHook, /catch \{\s*allowed = false;/);
  assert.match(
    home,
    /canSeeAdmin\s*&&\s*<AdminGameTile game="grid-defense" title="Grid Defense" icon=\{Target\} \/>/,
  );
  assert.match(
    home,
    /canSeeAdmin\s*&&\s*<AdminGameTile game="kupferkern" title="Kupferkern" icon=\{Activity\} \/>/,
  );
  assert.match(home, /function AdminGameTile/);
  assert.match(home, /Admin-Spiel/);
  assert.doesNotMatch(home, /PrivateGameTile|LockKeyhole/);
  assert.doesNotMatch(home, /<SportAppHeader|<TopNav/);
});

test("both games share the authenticated route and require server authorization", () => {
  assert.match(route, /createFileRoute\("\/_authenticated\/games"\)/);
  assert.match(route, /beforeLoad:[\s\S]*?getAdminAreaAccess\(\)/);
  assert.match(route, /Route\.useRouteContext\(\)/);
  assert.match(route, /usePrivateGameAccess\(userId, 5_000\)/);
  assert.match(route, /getPrivateGameDocument/);
  assert.match(route, /Grid Defense/);
  assert.match(route, /Kupferkern/);
  assert.match(route, /AloHomeLink/);
});
