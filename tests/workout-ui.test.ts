import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  adjustManualCount,
  formatWorkoutCount,
  manualWorkoutInput,
  parseManualCount,
  workoutCountUnit,
} from "../src/lib/workout-ui.ts";
import {
  createWorkoutSession,
  finishWorkoutSet,
  startWorkoutSet,
  summarizeWorkout,
} from "../src/lib/workout-session.ts";

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

test("invalid manual values have a visible reason and cannot submit in either design", () => {
  for (const value of ["1001", "1.5", "1e2", "-1", "abc"]) {
    const input = manualWorkoutInput(value);
    assert.equal(input.canSubmit, false);
    assert.equal(input.count, null);
    assert.match(input.error!, /Nur ganze Zahlen von 0 bis 1.000/);
  }
  assert.equal(manualWorkoutInput("").canSubmit, false);
  assert.equal(manualWorkoutInput("0").canSubmit, false);
  assert.deepEqual(manualWorkoutInput("1000"), { count: 1000, error: null, canSubmit: true });
  const source = readFileSync(
    new URL("../src/routes/_authenticated/workout.$exerciseId.tsx", import.meta.url),
    "utf8",
  );
  assert.equal((source.match(/!canSubmitManual/g) ?? []).length, 2);
  assert.equal((source.match(/aria-invalid=\{manualInputError !== null\}/g) ?? []).length, 2);
  assert.doesNotMatch(source, /parseInt\(manualInput, 10\)/);
  assert.match(source, /manualInputError \?\?/);
});

test("the second set cannot complete above the total cap and remains correctable", () => {
  assert.equal(manualWorkoutInput("600", 0).canSubmit, true);
  const overBudget = manualWorkoutInput("600", 600);
  assert.equal(overBudget.count, 600);
  assert.equal(overBudget.canSubmit, false);
  assert.match(overBudget.error!, /Für diesen Satz bleiben 400/);
  assert.deepEqual(manualWorkoutInput("400", 600), { count: 400, error: null, canSubmit: true });
  assert.equal(manualWorkoutInput("1", 1000).canSubmit, false);
});

test("a 600 plus 600 draft stays active until the second set is corrected to 400", () => {
  let session = startWorkoutSet(
    createWorkoutSession({ sets: 2, reps: null, restSeconds: 0, title: null }, 0, "budget-case"),
    1_000,
  );
  session = finishWorkoutSet({ ...session, currentReps: 600 }, 2_000);
  session = startWorkoutSet(session, 3_000);
  session = { ...session, currentReps: 600 };
  const completed = session.setReps.reduce((sum, count) => sum + count, 0);
  if (manualWorkoutInput("600", completed).canSubmit) session = finishWorkoutSet(session, 4_000);
  assert.equal(session.phase, "active");
  assert.equal(session.currentReps, 600);
  assert.deepEqual(session.setReps, [600]);
  const corrected = manualWorkoutInput("400", completed);
  assert.equal(corrected.canSubmit, true);
  session = finishWorkoutSet({ ...session, currentReps: corrected.count! }, 5_000);
  assert.equal(session.phase, "completed");
  assert.equal(summarizeWorkout(session, 10_000).actualReps, 1000);
});

test("a confirmed first best marks the statistic loaded in both save paths", () => {
  const source = readFileSync(
    new URL("../src/routes/_authenticated/workout.$exerciseId.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /setBest\(savedCount\);\s*setBestStatus\("loaded"\)/);
  assert.match(source, /setBest\(n\);\s*setBestStatus\("loaded"\)/);
});

test("completed sets remain editable before plan completion in both layouts", () => {
  const source = readFileSync(
    new URL("../src/routes/_authenticated/workout.$exerciseId.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /isPlanned && session && session\.setReps\.length > 0/);
  assert.equal((source.match(/\{manualCompletedSetsReview\}/g) ?? []).length, 2);
  assert.match(
    source,
    /completedSetEditOwner !== JSON\.stringify\(\[routeContextKey, session\.id\]\)/,
  );
  assert.match(source, /manualInputState\.canSubmit && editingCompletedSet === null/);
  const correctionHandler = source.slice(
    source.indexOf("const applyCompletedSetEdit"),
    source.indexOf("const manualCompletedSetsReview"),
  );
  assert.doesNotMatch(correctionHandler, /session\.phase !== "completed"/);
  assert.match(correctionHandler, /next\.phase === "completed"/);
  assert.match(source, /Verbleibendes Trainingsbudget/);
});

test("completed unsaved drafts survive route hydration and retain their visible total", () => {
  const source = readFileSync(
    new URL("../src/routes/_authenticated/workout.$exerciseId.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /restored && restored\.phase !== "completed"/);
  assert.match(source, /if \(restored\) \{/);
  assert.match(
    source,
    /safeRestore\.phase === "completed"[\s\S]*?summarizeWorkout\(safeRestore\)\.actualReps/,
  );
});
