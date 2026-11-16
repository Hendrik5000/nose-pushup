import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { test } from "node:test";

test("the Alo sports route loads real football data instead of curated examples", () => {
  const root = process.cwd();
  const route = readFileSync(resolve(root, "src/routes/sports.tsx"), "utf8");
  assert.match(route, /createFileRoute\("\/sports"\)/);
  assert.match(route, /ssr: false/);
  assert.match(route, /footballTablePath\(leagueId, season\)/);
  assert.match(route, /footballMatchesPath\(leagueId, season\)/);
  assert.match(route, /parseFootballTable/);
  assert.match(route, /parseFootballMatches/);
  assert.match(route, /formatKickOff/);
});

test("the Alo sports route offers the German leagues and the national team", () => {
  const root = process.cwd();
  const lib = readFileSync(resolve(root, "src/lib/football.ts"), "utf8");
  const route = readFileSync(resolve(root, "src/routes/sports.tsx"), "utf8");
  assert.match(lib, /id: "bl1"/);
  assert.match(lib, /id: "bl2"/);
  assert.match(lib, /id: "bl3"/);
  assert.match(lib, /id: "deutschland"/);
  assert.match(lib, /getmatchdata\/deutschland/);
  assert.match(route, /aria-label="Ligaauswahl"/);
  assert.match(route, /FOOTBALL_LEAGUES\.map/);
  assert.match(route, /setLeagueId/);
});

test("the national team stays honest when OpenLigaDB lists no matches", () => {
  const root = process.cwd();
  const route = readFileSync(resolve(root, "src/routes/sports.tsx"), "utf8");
  assert.match(route, /sind aktuell keine Spiele in OpenLigaDB eingetragen\./);
  assert.match(route, /league\.hasTable && \(/);
  assert.match(route, /league\.id === "bl1" && \(/);
});

test("the Alo sports route no longer contains curated example data", () => {
  const root = process.cwd();
  const route = readFileSync(resolve(root, "src/routes/sports.tsx"), "utf8");
  assert.doesNotMatch(route, /Dortmund <span/);
  assert.doesNotMatch(route, /Ballbesitz/);
  assert.doesNotMatch(route, /Torsch\u00fcsse/);
  assert.doesNotMatch(route, /Tipps richtig/);
  assert.doesNotMatch(route, /Trefferquote/);
  assert.doesNotMatch(route, /kuratierten Matchdaten/);
  assert.doesNotMatch(route, /74\u2019/);
});

test("the Alo sports route stays honest with loading, error and empty states", () => {
  const root = process.cwd();
  const route = readFileSync(resolve(root, "src/routes/sports.tsx"), "utf8");
  assert.match(route, /role="alert"/);
  assert.match(route, /Bundesliga-Daten werden geladen/);
  assert.match(route, /Fu\u00dfball-Daten von OpenLigaDB/);
  assert.match(route, /Keine Tabellendaten verf\u00fcgbar\./);
  assert.match(route, /Keine angesetzten Spiele in den geladenen Daten\./);
  assert.match(route, /Noch kein Spiel beendet/);
  assert.match(route, /OpenLigaDB/);
});

test("the Alo sports route links to the full football table", () => {
  const root = process.cwd();
  const route = readFileSync(resolve(root, "src/routes/sports.tsx"), "utf8");
  assert.match(route, /to="\/football"/);
  assert.match(route, /Gesamte Tabelle in Alo Fu\u00dfball/);
});
