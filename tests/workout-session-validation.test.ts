import assert from "node:assert/strict";
import test from "node:test";
import {
  createWorkoutSession,
  finishWorkoutSet,
  pauseWorkout,
  readWorkoutSession,
  startWorkoutSet,
  workoutSessionStorageKey,
} from "../src/lib/workout-session.ts";

class StoredValue {
  value: string | null = null;
  getItem() {
    return this.value;
  }
}

function parseStored(value: unknown) {
  const storage = new StoredValue();
  storage.value = JSON.stringify(value);
  return readWorkoutSession(storage, workoutSessionStorageKey("guest-1", "pushup"));
}

test("persisted preparation, active, rest and paused plans retain started progress", () => {
  const plan = { sets: 2, reps: 5, restSeconds: 45, title: "Starter" };
  const preparing = createWorkoutSession(plan, 1_000, "stable-session");
  assert.deepEqual(parseStored(preparing), preparing);

  const active = startWorkoutSet(preparing, 2_000);
  assert.deepEqual(parseStored(active), active);

  const resting = finishWorkoutSet(active, 3_000);
  assert.deepEqual(parseStored(resting), resting);

  const paused = pauseWorkout(resting, 4_000);
  assert.deepEqual(parseStored(paused), paused);
  assert.equal(parseStored(paused)?.phase, "paused");
  assert.deepEqual(parseStored(paused)?.setReps, [0]);
});

test("malformed persisted plans and inconsistent session phases are rejected", () => {
  const valid = createWorkoutSession(
    { sets: 2, reps: 5, restSeconds: 45, title: "Starter" },
    1_000,
    "stable-session",
  );
  const cases: unknown[] = [
    { ...valid, plan: { ...valid.plan, sets: 21 } },
    { ...valid, plan: { ...valid.plan, reps: 101 } },
    { ...valid, plan: { ...valid.plan, reps: 51, sets: 20 } },
    { ...valid, plan: { ...valid.plan, restSeconds: 601 } },
    { ...valid, currentSet: 3 },
    { ...valid, setReps: [3] },
    { ...valid, phase: "active", startedAt: null },
    { ...valid, phase: "paused", startedAt: 1_000 },
    { ...valid, currentReps: -1 },
    { ...valid, elapsedBeforePauseMs: -1 },
  ];
  for (const candidate of cases) assert.equal(parseStored(candidate), null);
});
