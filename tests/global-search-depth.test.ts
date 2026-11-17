import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { test } from "node:test";

test("the Alo global search indexes every Alo Fußball league including the national team", () => {
  const root = process.cwd();
  const search = readFileSync(resolve(root, "src/components/alo/GlobalSearch.tsx"), "utf8");
  const football = readFileSync(resolve(root, "src/lib/football.ts"), "utf8");
  assert.match(search, /FOOTBALL_LEAGUES/);
  assert.match(search, /FOOTBALL_LEAGUE_HITS/);
  assert.match(search, /Alo Fu\u00dfball \u00b7 Liga/);
  assert.match(search, /Nationalmannschaft Deutschland L\u00e4nderspiele/);
  assert.match(search, /path: "\/football"/);
  for (const league of ["Bundesliga", "Premier League", "La Liga", "Serie A", "Ligue 1"]) {
    assert.match(football, new RegExp(league));
  }
});

test("the Alo global search indexes Alo Health exercises with deep workout links", () => {
  const root = process.cwd();
  const search = readFileSync(resolve(root, "src/components/alo/GlobalSearch.tsx"), "utf8");
  assert.match(search, /EXERCISE_CONFIG/);
  assert.match(search, /EXERCISE_HITS/);
  assert.match(search, /Alo Health \u00b7 \u00dcbung/);
  assert.match(search, /!\w+\.startsWith\("cali_"\)|!id\.startsWith\("cali_"\)/);
  assert.match(search, /exerciseId: id/);
  assert.match(search, /to="\/workout\/\$exerciseId"/);
  assert.match(search, /params=\{\{ exerciseId: h\.exerciseId \}\}/);
  assert.match(search, /Übung öffnen/);
});

test("the Alo global search indexes personal Mira marketplace app drafts", () => {
  const root = process.cwd();
  const search = readFileSync(resolve(root, "src/components/alo/GlobalSearch.tsx"), "utf8");
  assert.match(search, /listMiraMarketplaceDrafts\(userId\)/);
  assert.match(search, /Mira \u00b7 App-Entwurf/);
  assert.match(search, /Pers\u00f6nliche Marketplace-App/);
  assert.match(search, /sessionId: draft\.sessionId/);
});

test("the global search status text names the deepened sources", () => {
  const root = process.cwd();
  const search = readFileSync(resolve(root, "src/components/alo/GlobalSearch.tsx"), "utf8");
  assert.match(
    search,
    /sowie in Fu\u00dfball-Ligen und Health-\u00dcbungen; App-Entw\u00fcrfe, Nexus und Trainingspl\u00e4ne/,
  );
});
