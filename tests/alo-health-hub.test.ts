import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const health = readFileSync(
  new URL("../src/routes/_authenticated/health.tsx", import.meta.url),
  "utf8",
);

test("Alo-Health bündelt die verstreuten Gesundheits-/Fitness-Komponenten", () => {
  for (const importPath of [
    "ReadinessCard",
    "RecoveryCalendar",
    "WaterTracker",
    "MoodCheckin",
    "GymVisitCalendar",
    "SmartRestTimer",
  ]) {
    assert.ok(health.includes('from "@/components/' + importPath + '"'));
  }
});

test("Alo-Health hat Fitness-Sektion und Navigation in beiden Varianten", () => {
  assert.equal(health.match(/id="health-fitness"/g)?.length, 2);
  assert.equal(health.match(/href="#health-fitness"/g)?.length, 2);
  assert.match(health, /health-classic-fitness/);
  assert.match(health, /Fitness &amp; Erholung/);
  assert.match(health, /<Dumbbell/);
});

test("Alo-Health lädt Readiness-Daten nur lesend", () => {
  assert.ok(health.includes('.from("profiles")'));
  assert.ok(health.includes('.select("current_streak")'));
  assert.doesNotMatch(health, /\.from\("profiles"\)[\s\S]{0,80}\.insert/);
  assert.match(health, /\.upsert\(payload, \{ onConflict: "user_id,day" \}\)/);
});

test("Alo-Health behält bestehende Bereiche und den expliziten Timerstart", () => {
  for (const marker of [
    'createFileRoute("/_authenticated/health")',
    "<HealthConnectPanel />",
    "<SmartwatchPanel userId={userId} />",
    "<WeightTrendCard",
    "<SleepDebtCard",
    "<WeeklyStepsGoal",
    "Smart Pausen-Timer",
    "starten",
    "setShowRestTimer(true)",
  ]) {
    assert.ok(health.includes(marker), marker);
  }
});
