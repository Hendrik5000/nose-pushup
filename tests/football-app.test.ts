import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  NATIONAL_TEAM_ID,
  currentFootballSeason,
  footballApiUrl,
  formatKickOff,
  isLiveStatus,
  matchStatusLabel,
  nationalApiUrl,
  parseFootballMatches,
  parseFootballTable,
  parseNationalEvents,
  parseSportsDbTable,
  sportsDbSeason,
} from "../src/lib/football";

test("currentFootballSeason follows the Bundesliga season turn in August", () => {
  assert.equal(currentFootballSeason(new Date("2026-11-16T12:00:00Z")), 2026);
  assert.equal(currentFootballSeason(new Date("2026-08-01T00:00:00Z")), 2026);
  assert.equal(currentFootballSeason(new Date("2026-07-31T23:59:00Z")), 2025);
  assert.equal(currentFootballSeason(new Date("2027-05-15T12:00:00Z")), 2026);
});

test("footballApiUrl targets the OpenLigaDB host without double slashes", () => {
  assert.equal(
    footballApiUrl("getbltable/bl1/2026"),
    "https://api.openligadb.de/getbltable/bl1/2026",
  );
  assert.equal(
    footballApiUrl("/getmatchdata/bl1/2026/12"),
    "https://api.openligadb.de/getmatchdata/bl1/2026/12",
  );
});

test("parseFootballTable sorts by points, goal difference and goals", () => {
  const table = parseFootballTable([
    {
      teamName: "FC Bayern München",
      matches: 11,
      won: 8,
      draw: 2,
      lost: 1,
      goals: 30,
      opponentGoals: 12,
      points: 26,
    },
    {
      teamName: "SC Freiburg",
      matches: 11,
      won: 6,
      draw: 3,
      lost: 2,
      goals: 20,
      opponentGoals: 14,
      points: 21,
    },
    {
      teamName: "Bayer 04 Leverkusen",
      matches: 11,
      won: 6,
      draw: 3,
      lost: 2,
      goals: 22,
      opponentGoals: 14,
      points: 21,
    },
    {
      teamName: "Borussia Dortmund",
      matches: 11,
      won: 6,
      draw: 3,
      lost: 2,
      goals: 20,
      opponentGoals: 12,
      points: 21,
    },
    { teamName: "" },
    null,
  ]);
  assert.deepEqual(
    table.map(({ name }) => name),
    ["FC Bayern München", "Bayer 04 Leverkusen", "Borussia Dortmund", "SC Freiburg"],
  );
  assert.equal(table[0].position, 1);
  assert.equal(table[3].position, 4);
});

test("parseFootballTable rejects non-array payloads", () => {
  assert.deepEqual(parseFootballTable(null), []);
  assert.deepEqual(parseFootballTable({ error: "x" }), []);
});

test("parseFootballMatches reads final results and keeps open matches honest", () => {
  const matches = parseFootballMatches([
    {
      matchID: 83255,
      matchDateTimeUTC: "2026-12-04T19:30:00Z",
      matchIsFinished: false,
      matchResults: [],
      group: { groupName: "12. Spieltag", groupOrderID: 12 },
      team1: { teamName: "FC Bayern München" },
      team2: { teamName: "SC Paderborn 07" },
    },
    {
      matchID: 83256,
      matchDateTimeUTC: "2026-12-05T14:30:00Z",
      matchIsFinished: true,
      matchResults: [
        { resultTypeID: 1, pointsTeam1: 1, pointsTeam2: 0 },
        { resultTypeID: 2, pointsTeam1: 2, pointsTeam2: 1 },
      ],
      group: { groupName: "12. Spieltag", groupOrderID: 12 },
      team1: { teamName: "RB Leipzig" },
      team2: { teamName: "1. FSV Mainz 05" },
    },
    { matchID: 83257, team1: { teamName: "" }, team2: { teamName: "Ohne Gegner" } },
  ]);
  assert.equal(matches.length, 2);
  assert.equal(matches[0].home, "FC Bayern München");
  assert.equal(matches[0].finished, false);
  assert.equal(matches[0].homeGoals, null);
  assert.equal(matches[0].awayGoals, null);
  assert.equal(matches[0].groupOrder, 12);
  assert.equal(matches[1].homeGoals, 2);
  assert.equal(matches[1].awayGoals, 1);
  assert.equal(matches[1].finished, true);
});

test("parseFootballMatches falls back to the last reported result", () => {
  const matches = parseFootballMatches([
    {
      matchID: 1,
      matchIsFinished: true,
      matchResults: [{ resultTypeID: 3, pointsTeam1: 0, pointsTeam2: 3 }],
      team1: { teamName: "A" },
      team2: { teamName: "B" },
    },
  ]);
  assert.equal(matches[0].homeGoals, 0);
  assert.equal(matches[0].awayGoals, 3);
});

test("nationalApiUrl targets the TheSportsDB test endpoint", () => {
  assert.equal(
    nationalApiUrl(`eventsnext.php?id=${NATIONAL_TEAM_ID}`),
    "https://www.thesportsdb.com/api/v1/json/123/eventsnext.php?id=133907",
  );
  assert.equal(NATIONAL_TEAM_ID, "133907");
});

test("parseNationalEvents maps TheSportsDB events and treats the timestamp as UTC", () => {
  const matches = parseNationalEvents({
    events: [
      {
        idEvent: "2442781",
        strEvent: "Germany vs Serbia",
        strTimestamp: "2026-10-01T18:45:00",
        strHomeTeam: "Germany",
        strAwayTeam: "Serbia",
        intHomeScore: "2",
        intAwayScore: "0",
        strStatus: "FT",
        strLeague: "UEFA Nations League",
      },
      {
        idEvent: "2442854",
        strTimestamp: "2026-11-16T19:45:00",
        strHomeTeam: "Germany",
        strAwayTeam: "Netherlands",
        intHomeScore: "0",
        intAwayScore: "0",
        strStatus: "1H",
        strLeague: "UEFA Nations League",
      },
      { strHomeTeam: "", strAwayTeam: "Ohne Gegner" },
    ],
  });
  assert.equal(matches.length, 2);
  assert.equal(matches[0].id, "2442781");
  assert.equal(matches[0].home, "Germany");
  assert.equal(matches[0].away, "Serbia");
  assert.equal(matches[0].kickOffUtc, "2026-10-01T18:45:00Z");
  assert.equal(matches[0].finished, true);
  assert.equal(matches[0].homeGoals, 2);
  assert.equal(matches[0].awayGoals, 0);
  assert.equal(matches[0].groupName, "UEFA Nations League");
  assert.equal(matches[1].finished, false);
  assert.equal(matches[1].homeGoals, 0);
  assert.equal(matches[1].awayGoals, 0);
  assert.match(formatKickOff(matches[1].kickOffUtc), /16\.11\./);
});

test("parseNationalEvents stays honest without scores or payloads", () => {
  const matches = parseNationalEvents({
    events: [
      {
        idEvent: "1",
        strHomeTeam: "Germany",
        strAwayTeam: "France",
        intHomeScore: null,
        intAwayScore: null,
        strStatus: "NS",
      },
      { strHomeTeam: "Germany", strAwayTeam: "Italy", strTimestamp: "" },
    ],
  });
  assert.equal(matches.length, 2);
  assert.equal(matches[0].homeGoals, null);
  assert.equal(matches[0].awayGoals, null);
  assert.equal(matches[0].finished, false);
  assert.equal(matches[0].kickOffUtc, null);
  assert.deepEqual(parseNationalEvents(null), []);
  assert.deepEqual(parseNationalEvents({ error: "x" }), []);
});

test("sportsDbSeason follows the European season turn in August", () => {
  assert.equal(sportsDbSeason(new Date("2026-11-16T12:00:00Z")), "2026-2027");
  assert.equal(sportsDbSeason(new Date("2026-08-01T00:00:00Z")), "2026-2027");
  assert.equal(sportsDbSeason(new Date("2026-07-31T23:59:00Z")), "2025-2026");
});

test("parseSportsDbTable reads string ranks and sorts by position", () => {
  const table = parseSportsDbTable({
    table: [
      {
        intRank: "3",
        strTeam: "SSC Napoli",
        intPlayed: "11",
        intWin: "7",
        intDraw: "2",
        intLoss: "2",
        intGoalsFor: "21",
        intGoalsAgainst: "10",
        intPoints: "23",
        strForm: "WWLDW",
      },
      {
        intRank: "1",
        strTeam: "Arsenal",
        intPlayed: "11",
        intWin: "9",
        intDraw: "1",
        intLoss: "1",
        intGoalsFor: "24",
        intGoalsAgainst: "8",
        intPoints: "28",
        strForm: "WWWWD",
      },
      { intRank: "2", strTeam: "" },
      null,
    ],
  });
  assert.deepEqual(
    table.map(({ name }) => name),
    ["Arsenal", "SSC Napoli"],
  );
  assert.equal(table[0].position, 1);
  assert.equal(table[0].points, 28);
  assert.equal(table[1].matches, 11);
});

test("parseSportsDbTable rejects non-array payloads", () => {
  assert.deepEqual(parseSportsDbTable(null), []);
  assert.deepEqual(parseSportsDbTable({ error: "x" }), []);
});

test("isLiveStatus and matchStatusLabel map TheSportsDB statuses honestly", () => {
  assert.equal(isLiveStatus("1H"), true);
  assert.equal(isLiveStatus("HT"), true);
  assert.equal(isLiveStatus("2H"), true);
  assert.equal(isLiveStatus("ET"), true);
  assert.equal(isLiveStatus("P"), true);
  assert.equal(isLiveStatus("NS"), false);
  assert.equal(isLiveStatus(""), false);
  assert.equal(isLiveStatus("FT"), false);
  assert.equal(isLiveStatus("Postponed"), false);
  assert.equal(isLiveStatus(null), false);
  assert.equal(matchStatusLabel("1H"), "1. Halbzeit");
  assert.equal(matchStatusLabel("HT"), "Halbzeitpause");
  assert.equal(matchStatusLabel("2H"), "2. Halbzeit");
  assert.equal(matchStatusLabel("ET"), "Verl\u00e4ngerung");
  assert.equal(matchStatusLabel("P"), "Elfmeterschie\u00dfen");
  assert.equal(matchStatusLabel("FT"), "Beendet");
  assert.equal(matchStatusLabel("Postponed"), "Verschoben");
  assert.equal(matchStatusLabel("NS"), "Angesetzt");
});

test("parseNationalEvents keeps status, venue and round for league matches", () => {
  const matches = parseNationalEvents({
    events: [
      {
        idEvent: "2443001",
        strTimestamp: "2026-11-22T16:30:00",
        strHomeTeam: "Arsenal",
        strAwayTeam: "Manchester City",
        intHomeScore: "1",
        intAwayScore: "1",
        strStatus: "2H",
        strLeague: "Premier League",
        strVenue: "Emirates Stadium",
        intRound: "12",
      },
    ],
  });
  assert.equal(matches.length, 1);
  assert.equal(matches[0].status, "2H");
  assert.equal(matches[0].venue, "Emirates Stadium");
  assert.equal(matches[0].round, "12");
});

test("formatKickOff formats German kick-off times and stays honest without data", () => {
  assert.equal(formatKickOff(null), "Termin offen");
  assert.equal(formatKickOff("kein datum"), "Termin offen");
  assert.match(formatKickOff("2026-12-04T19:30:00Z"), /04\.12\./);
  assert.match(formatKickOff("2026-12-04T19:30:00Z"), /19:30/);
});

test("the Alo football route exists and loads real Bundesliga data", () => {
  const root = process.cwd();
  const route = readFileSync(resolve(root, "src/routes/football.tsx"), "utf8");
  assert.match(route, /createFileRoute\("\/football"\)/);
  assert.match(route, /footballApiUrl\(`getbltable\/bl1\/\$\{season\}`\)/);
  assert.match(route, /getmatchdata\/bl1\/\$\{season\}/);
  assert.match(route, /parseFootballTable/);
  assert.match(route, /parseFootballMatches/);
  assert.match(route, /aria-label="Vorheriger Spieltag"/);
  assert.match(route, /aria-label="Nächster Spieltag"/);
  assert.match(route, /Keine Tabellendaten verfügbar\./);
});

test("the football app is registered as a declarative Marketplace app", () => {
  const root = process.cwd();
  const marketplace = readFileSync(resolve(root, "src/lib/marketplace.ts"), "utf8");
  assert.match(marketplace, /id: "alo-football"/);
  assert.match(marketplace, /name: "Alo Fußball"/);
  assert.match(marketplace, /action: \{ type: "navigate", to: "\/football" \}/);
  assert.match(marketplace, /"\/football",/);
});
