import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { filterProfilesByName } from "../src/lib/leaderboard-search";

const read = (file: string) => readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8");

test("leaderboard name search is local, case-insensitive, trimmed and can find anonymous rows", () => {
  const profiles = [
    { id: "1", display_name: "Jörg Müller" },
    { id: "2", display_name: null },
    { id: "3", display_name: "Anna" },
  ];

  assert.deepEqual(filterProfilesByName(profiles, "  JÖRG "), [profiles[0]]);
  assert.deepEqual(filterProfilesByName(profiles, "ohne namen"), [profiles[1]]);
  assert.deepEqual(filterProfilesByName(profiles, " "), profiles);
});

test("Calisthenics scale choices expose their selected state and value to assistive technology", () => {
  const cali = read("components/CaliCheckin.tsx");
  assert.match(cali, /aria-pressed=\{energy === v\}/);
  assert.match(cali, /aria-pressed=\{soreness === v\}/);
  assert.match(cali, /aria-label=\{`Energie \$\{v\}:/);
  assert.match(cali, /aria-label=\{`Gelenke \/ Schmerz \$\{v\}:/);
});

test("run onboarding appears in both layouts and explains permission, GPS and saving threshold", () => {
  const run = read("routes/_authenticated/run.tsx");
  assert.equal((run.match(/<RunInstructions \/>/g) ?? []).length, 2);
  assert.match(run, /Standortzugriff/);
  assert.match(run, /GPS bereit/);
  assert.match(run, /Beenden[\s\S]*10\s+Metern/);
});

test("season empty state links to an existing next step", () => {
  const season = read("routes/_authenticated/season.tsx");
  assert.match(season, /Gerade läuft keine Saison/);
  assert.match(season, /to="\/programs"/);
  assert.match(season, /Trainingsprogramme öffnen/);
});

test("both leaderboards expose name search and keep ranks from the unfiltered ordering", () => {
  const battle = read("routes/_authenticated/battle-league.tsx");
  const leaderboard = read("routes/_authenticated/leaderboard.tsx");
  assert.match(battle, /type="search"/);
  assert.match(battle, /filterProfilesByName\(leaders, search\)/);
  assert.match(battle, /leaders\.findIndex\(\(leader\) => leader\.id === p\.id\)/);
  assert.match(leaderboard, /type="search"/);
  assert.match(leaderboard, /filterProfilesByName\(rows, search\)/);
  assert.match(leaderboard, /rows\.findIndex\(\(row\) => row\.id === p\.id\)/);
});

test("club join copy tells guests where to get a valid invitation code", () => {
  const clubs = read("routes/_authenticated/clubs.tsx");
  assert.match(clubs, /4–8 Zeichen langen Einladungscode/);
  assert.match(clubs, /tippe auf „Join“/);
});

test("quick capture shows its file-size limit beside the upload control", () => {
  const capture = read("components/alo/QuickCapture.tsx");
  assert.match(capture, /Foto, Audio oder Datei[\s\S]*max\. 1 MB je Datei/);
});

test("health history explains that dashes mean a value was not recorded", () => {
  const health = read("routes/_authenticated/health.tsx");
  assert.match(health, /Ein Gedankenstrich \(—\) bedeutet:[\s\S]*nicht erfasst/);
});

test("Alo tools can be opened by safe, validated deep links", () => {
  const tools = read("routes/_authenticated/tools.tsx");
  assert.match(tools, /validateSearch:[\s\S]*isWorkspaceToolId\(search\.tool\)/);
  assert.match(tools, /search=\{\{ tool: id \}\}/);
  assert.match(tools, /window\.dispatchEvent\(new CustomEvent\("alo-open", \{ detail: tool \}\)\)/);
});

test("common Sport page labels are at least 12px in the performance design", () => {
  const css = read("sport.css");
  assert.match(
    css,
    /html\[data-design-style="performance"\] :is\([\s\S]*?\.sport-eyebrow[\s\S]*?\.sport-hero-mark[\s\S]*?font-size: 0\.75rem/s,
  );
  assert.match(css, /\.sport-overview-metrics dt/);
  assert.match(css, /\.sport-section-number/);
});
