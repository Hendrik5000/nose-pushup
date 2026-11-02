import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

const route = readFileSync(resolve(process.cwd(), "src/routes/_authenticated/games.tsx"), "utf8");
const server = readFileSync(resolve(process.cwd(), "scripts/serve-private-game.mjs"), "utf8");

test("the game chooser is authenticated and exposes only the two distinct local preview routes", () => {
  assert.match(route, /createFileRoute\("\/_authenticated\/games"\)/);
  assert.match(route, /AloHomeLink/);
  assert.match(route, /Grid Defense/);
  assert.match(route, /z\.enum\(\["grid-defense", "kupferkern"\]\)/);
  assert.match(route, /Kupferkern/);
  assert.doesNotMatch(route, /Kronwacht|Sturmfront/i);
  assert.doesNotMatch(route, /AppNavigation|TopNav|BottomNav/);
});

test("the private game is embedded only from a different loopback origin", () => {
  assert.match(route, /sandbox="allow-scripts allow-same-origin"/);
  assert.match(route, /url\.origin === window\.location\.origin/);
  assert.match(route, /127\.0\.0\.1/);
  assert.match(route, /localhost/);
  assert.match(route, /VITE_PRIVATE_GAME_PREVIEW_URL/);
  assert.match(server, /server\.listen\(port, host/);
});

test("production remains locked even if the local preview query is copied", () => {
  assert.match(route, /isPrivateGamePreviewOpen/);
  assert.match(route, /import\.meta\.env\.DEV/);
  assert.match(route, /Produktions-Builds bleiben immer gesperrt/);
  assert.doesNotMatch(route, /<TopNav|<BottomNav|srcDoc/);
});

test("the page clearly says that the local rewrite is not legal clearance and preserves Home", () => {
  assert.match(route, /lokale Neufassung ist keine rechtliche Freigabe/);
  assert.match(route, /<AloHomeLink\s*\/>/);
  assert.match(route, /Spielauswahl/);
});
