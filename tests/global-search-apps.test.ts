import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { test } from "node:test";

test("the Alo global search indexes the whole marketplace catalog", () => {
  const root = process.cwd();
  const search = readFileSync(resolve(root, "src/components/alo/GlobalSearch.tsx"), "utf8");
  assert.match(search, /MARKETPLACE_CATALOG\.map/);
  assert.match(search, /APP_HITS/);
  assert.match(search, /App · Marketplace/);
  assert.match(search, /\.\.\.SETTINGS, \.\.\.APP_HITS/);
  assert.match(search, /gameId/);
  assert.match(search, /toolId/);
  assert.match(search, /to="\/games"/);
  assert.match(search, /search=\{\{ game: h\.gameId \}\}/);
  assert.match(search, /Spiel öffnen/);
  assert.match(search, /Werkzeug öffnen/);
  assert.match(search, /onOpenAlo\(h\.toolId!\)/);
});

test("the Alo global search stays honest about its sources", () => {
  const root = process.cwd();
  const search = readFileSync(resolve(root, "src/components/alo/GlobalSearch.tsx"), "utf8");
  assert.match(search, /Sucht lokal in Mira, Alo, Apps, Spielen und Einstellungen/);
  assert.match(search, /Kein KI-Anbieter erhält die Suche/);
  assert.match(search, /Training, Mira, Nexus, Apps, Spiele/);
  assert.match(search, /Apps, Spiele und Werkzeuge werden lokal im Alo-Katalog durchsucht\./);
});

test("the app search derives hits only from the real Alo catalog", () => {
  const root = process.cwd();
  const lib = readFileSync(resolve(root, "src/lib/marketplace.ts"), "utf8");
  const search = readFileSync(resolve(root, "src/components/alo/GlobalSearch.tsx"), "utf8");
  assert.match(lib, /export const MARKETPLACE_CATALOG/);
  assert.doesNotMatch(search, /title: "Grid Defense"/);
  assert.doesNotMatch(search, /title: "Alo Sports"/);
  assert.match(search, /plugin\.name/);
  assert.match(search, /plugin\.description/);
});
