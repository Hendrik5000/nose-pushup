import assert from "node:assert/strict";
import test from "node:test";
import { computeReadiness } from "../src/lib/readiness.ts";

// Tests run in Node without browser storage, so there is no local check-in.
test("Readiness does not present a score with fewer than two independent sources", () => {
  const result = computeReadiness({
    sleepMin: 480,
    steps: null,
    workoutsLast7Days: null,
    streak: 20,
  });
  assert.equal(result.available, false);
  assert.equal(result.score, 0);
  assert.match(result.label, /Daten/);
  assert.deepEqual(result.sources, ["Schlaf"]);
  assert.match(result.detail, /mindestens zwei Datenquellen/);
});

test("Readiness uses only measured values and keeps the existing numeric score contract", () => {
  const result = computeReadiness({ sleepMin: 480, steps: null, workoutsLast7Days: 4, streak: 0 });
  assert.equal(result.available, true);
  assert.equal(typeof result.score, "number");
  assert.equal(result.score, 79); // round((30 sleep + 25 load) / (30 + 25 + 15 streak capacity) * 100)
  assert.deepEqual(result.sources, ["Schlaf", "Workouts der letzten 7 Tage"]);
  assert.deepEqual(result.missingSources, []);
  assert.doesNotMatch(result.detail, /Check-in/);
});

test("no saved workouts and invalid sleep do not create available readiness", () => {
  assert.equal(
    computeReadiness({ sleepMin: 480, steps: 9000, workoutsLast7Days: 0, streak: 0 }).available,
    false,
  );
  assert.equal(
    computeReadiness({ sleepMin: NaN, steps: 9000, workoutsLast7Days: 3, streak: 5 }).available,
    false,
  );
});
