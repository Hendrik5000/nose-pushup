import assert from "node:assert/strict";
import test from "node:test";
import {
  correctCompletedWorkoutSet,
  createWorkoutSession,
  discardWorkout,
  extendWorkoutRest,
  finishWorkoutSet,
  pauseWorkout,
  readWorkoutSession,
  recordWorkoutRep,
  startWorkoutSet,
  summarizeWorkout,
  undoWorkoutRep,
  workoutSessionStorageKey,
  writeWorkoutSession,
  type WorkoutSession,
} from "../src/lib/workout-session.ts";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const key = workoutSessionStorageKey("guest-1", "pushup");

function roundtrip(session: WorkoutSession) {
  const storage = new MemoryStorage();
  assert.equal(writeWorkoutSession(storage, key, session), true);
  assert.deepEqual(readWorkoutSession(storage, key), session);
}

function parseStored(session: unknown) {
  const storage = new MemoryStorage();
  storage.setItem(key, JSON.stringify(session));
  return readWorkoutSession(storage, key);
}

test("a legacy completed 600 plus 600 draft can be corrected without losing its other set", () => {
  let session = startWorkoutSet(
    createWorkoutSession(
      { sets: 2, reps: null, restSeconds: 0, title: null },
      0,
      "legacy-over-cap",
    ),
    1_000,
  );
  session = finishWorkoutSet({ ...session, currentReps: 600 }, 2_000);
  session = startWorkoutSet(session, 3_000);
  session = finishWorkoutSet({ ...session, currentReps: 600 }, 4_000);
  assert.equal(summarizeWorkout(session).actualReps, 1200);
  roundtrip(session);
  const corrected = correctCompletedWorkoutSet(session, 1, 400);
  assert.deepEqual(corrected.setReps, [600, 400]);
  assert.deepEqual(session.setReps, [600, 600]);
  assert.equal(corrected.id, session.id);
  assert.equal(corrected.phase, "completed");
  assert.equal(corrected.startedAt, session.startedAt);
  assert.equal(corrected.elapsedBeforePauseMs, session.elapsedBeforePauseMs);
  assert.equal(summarizeWorkout(corrected).actualReps, 1000);
  roundtrip(corrected);
  for (const [index, reps] of [
    [-1, 400],
    [2, 400],
    [0.5, 400],
    [0, -1],
    [0, 1001],
    [0, 1.5],
    [0, NaN],
  ]) {
    assert.equal(correctCompletedWorkoutSet(session, index, reps), session);
  }
});

test("finished-set corrections preserve active input and allow incremental repair of old drafts", () => {
  const base = createWorkoutSession(
    { sets: 3, reps: null, restSeconds: 0, title: null },
    0,
    "incremental-repair",
  );
  const active: WorkoutSession = {
    ...base,
    phase: "active",
    currentSet: 3,
    setReps: [600, 600],
    currentReps: 600,
    startedAt: 1_000,
  };
  const first = correctCompletedWorkoutSet(active, 0, 0);
  assert.equal(summarizeWorkout(first).actualReps, 1200);
  assert.equal(first.currentReps, 600);
  assert.equal(first.phase, "active");
  const repaired = correctCompletedWorkoutSet(first, 1, 400);
  assert.equal(summarizeWorkout(repaired).actualReps, 1000);
  assert.equal(repaired.currentReps, 600);
  roundtrip(repaired);
});

test("all legitimate lifecycle phases survive in-memory write/read roundtrips", () => {
  const plan = { sets: 2, reps: 3, restSeconds: 30, title: "Roundtrip" };
  const created = createWorkoutSession(plan, 1_000, "session-roundtrip");
  const firstActive = startWorkoutSet(created, 2_000);
  const activeWithReps = recordWorkoutRep(recordWorkoutRep(firstActive));
  const resting = finishWorkoutSet(activeWithReps, 3_000);
  const secondActive = startWorkoutSet(resting, 4_000);
  const completed = finishWorkoutSet(recordWorkoutRep(secondActive), 5_000);
  const pausedBeforeStart = pauseWorkout(created, 1_500);
  const pausedWhileActive = pauseWorkout(activeWithReps, 3_500);
  const pausedDuringRest = pauseWorkout(resting, 3_500);
  const discardedAfterProgress = discardWorkout(pausedWhileActive);
  const discardedAfterCompletion = discardWorkout(completed);

  for (const state of [
    created,
    firstActive,
    activeWithReps,
    resting,
    secondActive,
    completed,
    pausedBeforeStart,
    pausedWhileActive,
    pausedDuringRest,
    discardedAfterProgress,
    discardedAfterCompletion,
  ]) {
    roundtrip(state);
  }

  assert.equal(readWorkoutSession(new MemoryStorage(), key), null);
  assert.equal(completed.phase, "completed");
  assert.equal(completed.setReps.length, plan.sets);
  assert.equal(readBackPhase(completed), "completed");
  assert.equal(pausedBeforeStart.phase, "paused");
  assert.equal(discardedAfterProgress.phase, "preparation");
});

function readBackPhase(session: WorkoutSession) {
  const storage = new MemoryStorage();
  writeWorkoutSession(storage, key, session);
  return readWorkoutSession(storage, key)?.phase;
}

test("malformed phase/count combinations are rejected", () => {
  const created = createWorkoutSession(
    { sets: 2, reps: 3, restSeconds: 30, title: null },
    1_000,
    "session-malformed",
  );
  const active = startWorkoutSet(created, 2_000);
  const resting = finishWorkoutSet(active, 3_000);
  const completed = finishWorkoutSet(startWorkoutSet(resting, 4_000), 5_000);

  const invalid: WorkoutSession[] = [
    { ...created, phase: "preparation", currentReps: 1 },
    { ...created, phase: "preparation", currentSet: 2 },
    { ...active, phase: "active", startedAt: null },
    { ...active, setReps: [1] },
    { ...resting, phase: "rest", currentSet: 1 },
    { ...resting, phase: "rest", currentReps: 1 },
    { ...resting, phase: "rest", restEndsAt: null },
    { ...resting, phase: "paused", restEndsAt: 4_000 },
    { ...completed, setReps: [0] },
    { ...completed, currentReps: 1 },
    { ...completed, currentSet: 1 },
  ];

  for (const candidate of invalid) assert.equal(parseStored(candidate), null);
  assert.equal(parseStored({ ...created, phase: "unknown" }), null);
});

test("a valid zero start timestamp retains elapsed time through pause and summary", () => {
  const active = startWorkoutSet(
    createWorkoutSession({ sets: 2, reps: 3, restSeconds: 30, title: null }, 0, "zero-clock"),
    0,
  );
  assert.equal(summarizeWorkout(active, 5_000).actualDurationMs, 5_000);
  const paused = pauseWorkout(active, 5_000);
  assert.equal(paused.elapsedBeforePauseMs, 5_000);
  assert.equal(summarizeWorkout(paused, 10_000).actualDurationMs, 5_000);
  roundtrip(paused);
});

test("nonfinite rest extensions cannot corrupt a persisted session", () => {
  const resting = finishWorkoutSet(
    startWorkoutSet(
      createWorkoutSession({ sets: 2, reps: 3, restSeconds: 30, title: null }, 1_000, "rest-clock"),
      1_000,
    ),
    2_000,
  );
  for (const seconds of [NaN, Infinity, -Infinity]) {
    assert.equal(extendWorkoutRest(resting, seconds), resting);
    roundtrip(extendWorkoutRest(resting, seconds));
  }
});

test("completed duration stops at the final set, including after restore", () => {
  const active = startWorkoutSet(
    createWorkoutSession({ sets: 1, reps: 3, restSeconds: 30, title: null }, 0, "finished-clock"),
    1_000,
  );
  const completed = finishWorkoutSet(recordWorkoutRep(active), 6_000);
  assert.equal(completed.startedAt, null);
  assert.equal(summarizeWorkout(completed, 60_000).actualDurationMs, 5_000);
  const restored = parseStored(completed);
  assert.ok(restored);
  assert.equal(summarizeWorkout(restored, 600_000).actualDurationMs, 5_000);
  // The reader still accepts the previous version-1 completed representation.
  const legacyCompleted = { ...completed, startedAt: 1_000, elapsedBeforePauseMs: 0 };
  assert.deepEqual(parseStored(legacyCompleted), legacyCompleted);
});

test("bounded lifecycle action sequences always remain restorable", () => {
  for (const sets of [1, 2, 3, 20]) {
    for (const reps of [null, 1, 5, 50]) {
      for (const restSeconds of [0, 30, 600]) {
        let session = createWorkoutSession({ sets, reps, restSeconds, title: null }, 0, "sequence");
        let now = 0;
        for (let index = 0; index < 80; index += 1) {
          now += 250;
          session = startWorkoutSet(session, now);
          session = recordWorkoutRep(session);
          roundtrip(session);
          if (index % 4 === 0) {
            session = undoWorkoutRep(session);
            roundtrip(session);
          }
          if (index % 3 === 0) {
            session = pauseWorkout(session, now + 100);
            roundtrip(session);
            session = startWorkoutSet(session, now + 150);
          }
          session = finishWorkoutSet(session, now + 200);
          roundtrip(session);
          session = extendWorkoutRest(session, 30);
          roundtrip(session);
          if (session.phase === "completed") {
            const duration = summarizeWorkout(session, now + 200).actualDurationMs;
            assert.equal(summarizeWorkout(session, now + 20_000).actualDurationMs, duration);
            session = discardWorkout(session);
            roundtrip(session);
          }
        }
      }
    }
  }
});
