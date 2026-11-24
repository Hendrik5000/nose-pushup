import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
const root = process.cwd();
const chess = readFileSync(resolve(root, "private-game-preview/chess.html"), "utf8");
const policy = readFileSync(resolve(root, "src/lib/private-game-policy.ts"), "utf8");
const route = readFileSync(resolve(root, "src/routes/_authenticated/games.tsx"), "utf8");
test("Alo chess is registered in the authenticated Admin-only games hub", () => {
  assert.match(policy, /PRIVATE_GAME_IDS = \[/);
  for (const id of ["grid-defense", "kupferkern", "neon-starfighter", "chess"]) {
    assert.ok(policy.includes(`"${id}"`));
  }
  assert.match(route, /getAdminAreaAccess\(\)/);
  assert.match(route, /game: "chess"/);
  assert.match(route, /title: "Alo Schach"/);
  const previousGameIds = ["grid-defense", "kupferkern", "neon-starfighter"];
  for (const id of previousGameIds) assert.ok(route.includes(id));
});
test("chess is isolated and uses legal move validation", () => {
  assert.match(chess, /alo-chess-server-only-v1/);
  assert.match(chess, /Content-Security-Policy/);
  assert.match(chess, /aria-label/);
  assert.match(chess, /prefers-reduced-motion/);
  assert.match(chess, /chess.js/);
  assert.match(chess, /game.moves/);
  assert.match(chess, /isCheckmate/);
  assert.match(chess, /isStalemate/);
  assert.match(chess, /pending/);
  assert.doesNotMatch(chess, /supabase|localStorage|fetch\(/i);
});
