import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { buildHealthCsv, type HealthExportEntry } from "../src/lib/health-export.ts";

const healthRoute = readFileSync(
  new URL("../src/routes/_authenticated/health.tsx", import.meta.url),
  "utf8",
);

test("health CSV includes records older than 14 days in ascending order and escapes cells", () => {
  const entries: HealthExportEntry[] = [
    {
      day: "2026-11-25",
      steps: 8000,
      active_kcal: 500,
      weight_kg: 71.2,
      sleep_min: 420,
      source: "manual",
    },
    {
      day: "2001-01-01",
      steps: 1200,
      active_kcal: 400,
      weight_kg: 72.5,
      sleep_min: 480,
      source: 'watch, "night"',
    },
  ];

  assert.equal(
    buildHealthCsv(entries),
    [
      "datum,schritte,aktive_kcal,gewicht_kg,schlaf_min,quelle",
      '2001-01-01,1200,400,72.5,480,"watch, ""night"""',
      "2026-11-25,8000,500,71.2,420,manual",
    ].join("\n"),
  );
});

test("health history is paginated to load every saved record rather than capped at 14", () => {
  const load = healthRoute.match(/const load = async \(\) => \{([\s\S]*?)\n  \};/);
  assert.ok(load, "health history load function exists");
  assert.match(load[1], /const pageSize = 500/);
  assert.match(load[1], /\.range\(start, start \+ pageSize - 1\)/);
  assert.match(load[1], /allEntries\.push\(\.\.\.page\)/);
  assert.match(load[1], /if \(page\.length < pageSize\) break/);
  assert.doesNotMatch(load[1], /\.limit\(14\)/);
  assert.match(healthRoute, /<HealthToolbox entries=\{entries\} \/>/);
});
