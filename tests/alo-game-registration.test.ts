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
const route = readFileSync(resolve(root, "src/routes/games.tsx"), "utf8");
const publicServerFunction = readFileSync(
  resolve(root, "src/lib/public-game.functions.ts"),
  "utf8",
);
const privateServerFunction = readFileSync(
  resolve(root, "src/lib/private-game.functions.ts"),
  "utf8",
);
const accessHook = readFileSync(resolve(root, "src/lib/use-private-game-access.ts"), "utf8");

function adminGateRange(source: string): [number, number] {
  const start = source.indexOf("if (canSeeAdmin)");
  assert.ok(start >= 0, "the canSeeAdmin gate should exist");
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return [start, i];
    }
  }
  return [start, -1];
}

test("Home surfaces both game tiles for every signed-in user without an Admin gate", () => {
  assert.match(
    homeTileBuilder,
    /id: "grid-defense"[\s\S]*?game: "grid-defense"[\s\S]*?id: "kupferkern"[\s\S]*?game: "kupferkern"/,
  );
  const [gateStart, gateEnd] = adminGateRange(homeTileBuilder);
  assert.ok(gateEnd > gateStart, "the Admin gate block should be closed");
  const gateBlock = homeTileBuilder.slice(gateStart, gateEnd + 1);
  assert.match(gateBlock, /id: "admin"/);
  assert.doesNotMatch(gateBlock, /marketplace|grid-defense|kupferkern/);
  assert.ok(homeTileBuilder.indexOf('id: "grid-defense"') > gateEnd);
  assert.ok(homeTileBuilder.indexOf('id: "marketplace"') > gateEnd);
  assert.match(home, /setCanSeeAdmin\(false\)/);
});

test("the public games route delivers documents without authentication", () => {
  assert.match(route, /createFileRoute\("\/games"\)/);
  assert.doesNotMatch(route, /getAdminAreaAccess|beforeLoad/);
  assert.match(route, /getPublicGameDocument\(\{ data: \{ game: requestGame \} \}\)/);
  assert.match(publicServerFunction, /createServerFn\(\{ method: "POST" \}\)/);
  assert.doesNotMatch(publicServerFunction, /requireSupabaseAuth|withAdminGameAccess/);
  assert.match(publicServerFunction, /z\.enum\(PUBLIC_GAME_IDS\)/);
  assert.match(publicServerFunction, /Cache-Control", "no-store/);
});

test("the admin-only private game delivery stays server-authorized", () => {
  assert.match(privateServerFunction, /middleware\(\[requireSupabaseAuth\]\)/);
  assert.match(privateServerFunction, /has_global_role/);
  assert.match(privateServerFunction, /p_role_name: "admin"/);
  assert.match(privateServerFunction, /Cache-Control", "private, no-store/);
  assert.match(accessHook, /onAuthStateChange/);
});

test("both named games render only through the sandboxed public games route", () => {
  assert.match(route, /Grid Defense/);
  assert.match(route, /Kupferkern/);
  assert.match(route, /sandbox="allow-scripts"/);
  assert.doesNotMatch(route, /allow-same-origin|src=\{(?:frameUrl|gameUrl)\}/);
});
