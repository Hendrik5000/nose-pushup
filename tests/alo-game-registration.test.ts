import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

const home = readFileSync(resolve(process.cwd(), "src/routes/_authenticated/index.tsx"), "utf8");
const route = readFileSync(resolve(process.cwd(), "src/routes/_authenticated/games.tsx"), "utf8");

test("Home provides two distinct locked local-preview tiles", () => {
  assert.match(
    home,
    /<PrivateGameTile game="grid-defense" title="Grid Defense" icon=\{Target\} \/>/,
  );
  assert.match(home, /<PrivateGameTile game="kupferkern" title="Kupferkern" icon=\{Activity\} \/>/);
  assert.match(home, /Private Vorschau/);
  assert.match(home, /<LockKeyhole/);
  assert.match(route, /Spielauswahl/);
  assert.doesNotMatch(home, /<SportAppHeader|<TopNav/);
});

test("both games share the authenticated app route and keep explicit names", () => {
  assert.match(route, /createFileRoute\("\/_authenticated\/games"\)/);
  assert.match(route, /Grid Defense/);
  assert.match(route, /Kupferkern/);
  assert.match(route, /AloHomeLink/);
});
