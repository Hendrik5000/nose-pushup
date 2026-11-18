import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { HealthEntryInputError, mergeHealthEntryMetrics } from "../src/lib/health-entry.ts";

const existing = { steps: 8200, active_kcal: 430, weight_kg: 67.5, sleep_min: 455 };

const emptyDraft = { steps: "", kcal: "", weight: "", sleepHours: "" };

test("blank Health fields preserve previously saved daily metrics", () => {
  assert.deepEqual(mergeHealthEntryMetrics(existing, emptyDraft), existing);
});

test("partial manual entries update only the fields the user entered", () => {
  assert.deepEqual(mergeHealthEntryMetrics(existing, { ...emptyDraft, steps: "9000" }), {
    ...existing,
    steps: 9000,
  });
  assert.deepEqual(
    mergeHealthEntryMetrics(existing, { ...emptyDraft, weight: "68.2", sleepHours: "7.5" }),
    { ...existing, weight_kg: 68.2, sleep_min: 450 },
  );
});

test("a new day gets safe defaults for metrics that were not entered", () => {
  assert.deepEqual(mergeHealthEntryMetrics(null, { ...emptyDraft, steps: "1200" }), {
    steps: 1200,
    active_kcal: 0,
    weight_kg: null,
    sleep_min: 0,
  });
});

test("Health metrics are bounded and malformed values are rejected", () => {
  assert.deepEqual(
    mergeHealthEntryMetrics(null, {
      steps: "999999",
      kcal: "-1",
      weight: "900",
      sleepHours: "30",
    }),
    { steps: 200000, active_kcal: 0, weight_kg: 400, sleep_min: 1440 },
  );
  assert.throws(
    () => mergeHealthEntryMetrics(existing, { ...emptyDraft, steps: "2.5" }),
    HealthEntryInputError,
  );
  assert.throws(
    () => mergeHealthEntryMetrics(existing, { ...emptyDraft, weight: "NaN" }),
    /Gewicht/,
  );
});

test("the Health route reads and merges the existing day before upsert", () => {
  const health = readFileSync(
    new URL("../src/routes/_authenticated/health.tsx", import.meta.url),
    "utf8",
  );
  assert.match(health, /\.select\("steps, active_kcal, weight_kg, sleep_min"\)/);
  assert.match(health, /mergeHealthEntryMetrics\(existing,/);
  assert.match(health, /\.upsert\(payload, \{ onConflict: "user_id,day" \}\)/);
});
