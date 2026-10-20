import assert from "node:assert/strict";
import test from "node:test";
import {
  adjustManualCount,
  formatWorkoutCount,
  parseManualCount,
  workoutCountUnit,
} from "../src/lib/workout-ui.ts";

test("manual counts accept only whole digits within the supported range", () => {
  assert.equal(parseManualCount("1"), 1);
  assert.equal(parseManualCount("001"), 1);
  assert.equal(parseManualCount("1000"), 1000);
  for (const invalid of ["", "1.5", "1,5", "-1", "+1", "1e2", " 1", "1001"]) {
    assert.equal(parseManualCount(invalid), null, `reject ${JSON.stringify(invalid)}`);
  }
});

test("manual count adjustment preserves malformed input instead of stripping characters", () => {
  assert.equal(adjustManualCount("9", 1), "10");
  assert.equal(adjustManualCount("", 1), "1");
  assert.equal(adjustManualCount("1.5", 1), "1.5");
  assert.equal(adjustManualCount("1000", 1), "1000");
});

test("workout totals use seconds for timed exercises and repetitions otherwise", () => {
  assert.equal(formatWorkoutCount(1, "seconds"), "1 Sekunde");
  assert.equal(formatWorkoutCount(30, "seconds"), "30 Sekunden");
  assert.equal(formatWorkoutCount(1, "reps"), "1 Wiederholung");
  assert.equal(formatWorkoutCount(5, "reps"), "5 Wiederholungen");
  assert.equal(workoutCountUnit("seconds"), "Sek.");
  assert.equal(workoutCountUnit("reps"), "Wdh.");
});
