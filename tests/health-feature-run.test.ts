import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { buildHealthCsv } from "@/lib/health-export";
import { bmiCategory, calculateBmi } from "@/lib/body-metrics";
import { evaluateHealthMilestones } from "@/lib/health-milestones";
import { formatWeight, kgToLb, lbToKg } from "@/lib/weight-units";
import { summarizeSleep } from "@/lib/sleep-insights";

const entry = (over: Partial<{
  day: string;
  steps: number;
  active_kcal: number;
  weight_kg: number | null;
  sleep_min: number;
  source: string;
}>) => ({
  day: "2026-11-15",
  steps: 0,
  active_kcal: 0,
  weight_kg: null,
  sleep_min: 0,
  source: "manual",
  ...over,
});

test("HealthToolbox exportiert CSV sortiert und stabil", () => {
  const csv = buildHealthCsv([
    entry({ day: "2026-11-15", steps: 8000, active_kcal: 400, weight_kg: 78.5, sleep_min: 450 }),
    entry({ day: "2026-11-14", steps: 3000, source: "health_connect" }),
  ]);
  const lines = csv.split("\n");
  assert.equal(lines[0], "datum,schritte,aktive_kcal,gewicht_kg,schlaf_min,quelle");
  assert.match(lines[1], /2026-11-14,3000,0,,0,health_connect/);
  assert.equal(lines[2], "2026-11-15,8000,400,78.5,450,manual");
});

test("HealthToolbox berechnet BMI, Meilensteine, Gewicht und Schlaf-Insights", () => {
  assert.ok(Math.abs(calculateBmi(78.5, 180)! - 24.2) < 0.1);
  assert.equal(calculateBmi(78.5, 300), null);
  assert.equal(bmiCategory(17).label, "Untergewicht");
  assert.equal(bmiCategory(23).label, "Normalgewicht");
  assert.equal(bmiCategory(27).label, "Übergewicht");
  assert.equal(bmiCategory(35).label, "Adipositas");
  const milestones = evaluateHealthMilestones([entry({ day: "2026-11-10", steps: 10500 })]);
  assert.equal(milestones.find((item) => item.id === "steps-10k")?.achieved, true);
  assert.ok(Math.abs(kgToLb(100) - 220.46) < 0.01);
  assert.ok(Math.abs(lbToKg(220.462) - 100) < 0.01);
  assert.equal(formatWeight(78.5, "kg"), "78.5 kg");
  assert.equal(formatWeight(0, "kg"), "—");
  assert.equal(summarizeSleep([]).nights, 0);
});

test("HealthToolbox ist in beiden Health-Varianten eingebunden", () => {
  const component = readFileSync(new URL("../src/components/HealthToolbox.tsx", import.meta.url), "utf8");
  const health = readFileSync(new URL("../src/routes/_authenticated/health.tsx", import.meta.url), "utf8");
  assert.match(component, /export function HealthToolbox/);
  assert.match(component, /downloadHealthCsv/);
  assert.doesNotMatch(component, /supabase/);
  assert.match(health, /from "@\/components\/HealthToolbox"/);
  assert.equal(health.match(/<HealthToolbox entries=\{entries\} \/>/g)?.length, 2);
});
