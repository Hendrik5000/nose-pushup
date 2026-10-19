import assert from "node:assert/strict";
import test from "node:test";
import {
  createWorkoutSession,
  extendWorkoutRest,
  finishWorkoutSet,
  pauseWorkout,
  readWorkoutMetadata,
  recordWorkoutRep,
  startWorkoutSet,
  summarizeWorkout,
  undoWorkoutRep,
  validateWorkoutSearch,
  workoutMetadataStorageKey,
  writeWorkoutMetadata,
} from "../src/lib/workout-session.ts";

test("search accepts known modes and bounded plan fields only", () => {
  assert.deepEqual(
    validateWorkoutSearch({ mode: "camera", sets: "4", reps: 10, rest_s: 60, title: " Push " }),
    {
      mode: "camera",
      sets: 4,
      reps: 10,
      rest_s: 60,
      title: "Push",
    },
  );
  assert.deepEqual(
    validateWorkoutSearch({ mode: "invalid", sets: 99, reps: 200, rest_s: -1, title: " " }),
    {},
  );
  assert.deepEqual(validateWorkoutSearch({ sets: 5, reps: 200 }), { sets: 5 });
  assert.deepEqual(validateWorkoutSearch({ sets: 30, reps: 10 }), {});
  assert.deepEqual(validateWorkoutSearch({ reps: true }), {});
});

test("rep correction, set transitions and rest extension retain phase invariants", () => {
  let s = createWorkoutSession(
    { sets: 2, reps: 2, restSeconds: 30, title: null },
    1000,
    "row-uuid",
  );
  assert.equal(s.phase, "preparation");
  s = startWorkoutSet(s, 1000);
  s = recordWorkoutRep(recordWorkoutRep(s));
  assert.equal(s.currentReps, 2);
  s = undoWorkoutRep(s);
  assert.equal(s.currentReps, 1);
  s = finishWorkoutSet(s, 5000);
  assert.equal(s.phase, "rest");
  assert.equal(s.currentSet, 2);
  assert.equal(s.setReps[0], 1);
  assert.equal(s.restEndsAt, 35_000);
  s = extendWorkoutRest(s, 30);
  assert.equal(s.restEndsAt, 65_000);
  s = startWorkoutSet(s, 6000);
  s = recordWorkoutRep(recordWorkoutRep(s));
  s = finishWorkoutSet(s);
  assert.equal(s.phase, "completed");
  assert.deepEqual(summarizeWorkout(s, 11_000), {
    plannedSets: 2,
    actualSets: 2,
    plannedReps: 4,
    actualReps: 3,
    plannedDurationMs: null,
    actualDurationMs: 10_000,
    partial: false,
  });
});

test("paused work is a partial summary and metadata is keyed by user plus row UUID", () => {
  let s = startWorkoutSet(
    createWorkoutSession({ sets: 3, reps: 5, restSeconds: 30, title: null }, 1000, "stable-id"),
  );
  s = recordWorkoutRep(s);
  s = pauseWorkout(s, 6000);
  assert.equal(s.phase, "paused");
  assert.equal(summarizeWorkout(s, 7000).partial, true);
  const map = new Map<string, string>();
  const storage = {
    setItem: (key: string, value: string) => map.set(key, value),
    getItem: (key: string) => map.get(key) ?? null,
  };
  const metadata = {
    version: 1 as const,
    rowId: "stable-id",
    userId: "user-1",
    exerciseId: "pushup",
    partial: true,
    summary: summarizeWorkout(s, 7000),
    createdAt: new Date(7000).toISOString(),
  };
  assert.equal(writeWorkoutMetadata(storage, metadata), true);
  assert.equal(map.has(workoutMetadataStorageKey("user-1", "stable-id")), true);
  assert.deepEqual(readWorkoutMetadata(storage, "user-1", "stable-id"), metadata);
  assert.equal(readWorkoutMetadata(storage, "another-user", "stable-id"), null);
});
