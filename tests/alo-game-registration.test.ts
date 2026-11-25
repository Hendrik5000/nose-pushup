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
const privateServerFunction = readFileSync(
  resolve(root, "src/lib/private-game.functions.ts"),
  "utf8",
);
const privatePolicy = readFileSync(resolve(root, "src/lib/private-game-policy.ts"), "utf8");
const accessHook = readFileSync(resolve(root, "src/lib/use-private-game-access.ts"), "utf8");

function blockAt(source: string, start: number): string {
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  return "";
}

test("all four Home game tiles are visible to signed-in users while Admin tiles stay gated", () => {
  const adminGates: string[] = [];
  let searchFrom = 0;
  while (true) {
    const gateStart = homeTileBuilder.indexOf("if (canSeeAdmin)", searchFrom);
    if (gateStart < 0) break;
    const gate = blockAt(homeTileBuilder, gateStart);
    adminGates.push(gate);
    searchFrom = gateStart + gate.length;
  }
  assert.ok(adminGates.some((gate) => gate.includes('id: "admin"')));
  for (const id of ["grid-defense", "kupferkern", "neon-starfighter", "chess"]) {
    assert.ok(homeTileBuilder.includes(`id: "${id}"`), `${id} tile should be registered`);
    assert.ok(
      adminGates.every((gate) => !gate.includes(`id: "${id}"`)),
      `${id} tile should not be inside an Admin gate`,
    );
  }
  assert.match(homeTileBuilder, /if \(plugin\.action\.type === "open-game"\) continue/);
  assert.match(home, /setCanSeeAdmin\(false\)/);
});

test("the authenticated route serves game content through the private server function", () => {
  assert.match(route, /createFileRoute\("\/_authenticated\/games"\)/);
  assert.match(route, /usePrivateGameAccess\(user\.id\)/);
  assert.match(route, /getPrivateGameDocument\(\{ data: \{ game: requestGame \} \}\)/);
  assert.match(privateServerFunction, /middleware\(\[requireSupabaseAuth\]\)/);
  assert.match(privateServerFunction, /withAuthenticatedGameAccess/);
  assert.doesNotMatch(privateServerFunction, /has_global_role|p_role_name: "admin"/);
  assert.match(privateServerFunction, /Cache-Control", "private, no-store/);
  assert.match(privatePolicy, /isAnonymousClaim === true/);
  assert.match(accessHook, /onAuthStateChange/);
});

test("the four game documents are listed and only rendered in a sandboxed frame", () => {
  for (const [id, title] of [
    ["grid-defense", "Grid Defense"],
    ["kupferkern", "Kupferkern"],
    ["neon-starfighter", "Neon Starfighter"],
    ["chess", "Alo Schach"],
  ] as const) {
    assert.match(route, new RegExp(`game: "${id}"`));
    assert.match(route, new RegExp(title));
  }
  assert.match(route, /sandbox="allow-scripts"/);
  assert.doesNotMatch(route, /allow-same-origin|src=\{(?:frameUrl|gameUrl)\}/);
});

test("game documents do not claim that an Admin account is required", () => {
  for (const id of ["grid-defense", "kupferkern", "neon-starfighter", "chess"]) {
    const document = readFileSync(resolve(root, `private-game-preview/${id}.html`), "utf8");
    assert.doesNotMatch(document, /Admin-Konto erforderlich|Geschützte Admin-Auslieferung/i);
  }
});
