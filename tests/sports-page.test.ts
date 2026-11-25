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
  assert.match(lib, /id: "premier"/);
  assert.match(lib, /id: "laliga"/);
  assert.match(lib, /id: "seriea"/);
  assert.match(lib, /id: "ligue1"/);
  assert.match(lib, /sportsDbId: "4328"/);
  assert.match(lib, /sportsDbId: "4335"/);
  assert.match(lib, /sportsDbId: "4332"/);
  assert.match(lib, /sportsDbId: "4334"/);
  assert.match(lib, /getmatchdata\/deutschland/);
  assert.match(route, /aria-label="Ligaauswahl"/);
  assert.match(route, /FOOTBALL_LEAGUES\.map/);
  assert.match(route, /setLeagueId/);
});

test("the national team loads its matches from TheSportsDB and stays honest", () => {
  const root = process.cwd();
  const route = readFileSync(resolve(root, "src/routes/sports.tsx"), "utf8");
  const lib = readFileSync(resolve(root, "src/lib/football.ts"), "utf8");
  assert.match(lib, /NATIONAL_TEAM_ID = "133907"/);
  assert.match(lib, /thesportsdb\.com\/api\/v1\/json\/123/);
  assert.match(lib, /parseNationalEvents/);
  assert.match(route, /nationalApiUrl\(`eventsnext\.php\?id=\$\{NATIONAL_TEAM_ID\}`\)/);
  assert.match(route, /nationalApiUrl\(`eventslast\.php\?id=\$\{NATIONAL_TEAM_ID\}`\)/);
  assert.match(route, /parseNationalEvents/);
  assert.match(route, /sind aktuell keine Spiele in TheSportsDB eingetragen\./);
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
  assert.match(route, /Fu\u00dfball-Daten von OpenLigaDB und TheSportsDB/);
  assert.match(route, /Keine Tabellendaten verf\u00fcgbar\./);
  assert.match(route, /Keine angesetzten Spiele in den geladenen Daten\./);
  assert.match(route, /Am ausgew\u00e4hlten Spieltag wurde noch kein Spiel beendet\./);
  assert.match(route, /OpenLigaDB/);
});

test("the Alo sports route has one league selector and no repeated matchday statistics", () => {
  const root = process.cwd();
  const route = readFileSync(resolve(root, "src/routes/sports.tsx"), "utf8");
  assert.equal([...route.matchAll(/FOOTBALL_LEAGUES\.map/g)].length, 1);
  assert.doesNotMatch(route, /Spieltag-Statistik/);
});

test("the Alo sports route shows live matches with status, venue and refresh", () => {
  const root = process.cwd();
  const route = readFileSync(resolve(root, "src/routes/sports.tsx"), "utf8");
  const lib = readFileSync(resolve(root, "src/lib/football.ts"), "utf8");
  assert.match(route, /Live & Aktuell/);
  assert.match(route, /isLiveMatch/);
  assert.match(route, /matchStatusLabel/);
  assert.match(route, /aria-label="Daten aktualisieren"/);
  assert.match(route, /Gerade kein Live-Spiel in den geladenen Daten\./);
  assert.match(route, /sportsDbLeagueEventsPath/);
  assert.match(route, /sportsDbLeagueResultsPath/);
  assert.match(lib, /eventsnextleague\.php\?id=/);
  assert.match(lib, /eventspastleague\.php\?id=/);
  assert.match(lib, /lookuptable\.php\?l=/);
  assert.match(lib, /isLiveStatus/);
  assert.match(lib, /matchStatusLabel/);
});

test("the Alo sports route lets users pick and manage favorite teams", () => {
  const root = process.cwd();
  const route = readFileSync(resolve(root, "src/routes/sports.tsx"), "utf8");
  assert.match(route, /Lieblingsteams/);
  assert.match(route, /als Lieblingsteam merken/);
  assert.match(route, /loadFavoriteTeams/);
  assert.match(route, /toggleFavoriteTeam/);
  assert.match(
    readFileSync(resolve(root, "src/lib/favorite-teams.ts"), "utf8"),
    /alo-favorite-teams/,
  );
  assert.match(route, /Keine Spiele deiner Lieblingsteams in den geladenen Daten von/);
});

test("the Alo sports route links to the full football table", () => {
  const root = process.cwd();
  const route = readFileSync(resolve(root, "src/routes/sports.tsx"), "utf8");
  assert.match(route, /to="\/football"/);
  assert.match(route, /Gesamte Tabelle in Alo Fu\u00dfball/);
});
