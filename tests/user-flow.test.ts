import assert from "node:assert/strict";
import test from "node:test";
import { applyPlanFeedback, parseAiResponse } from "../src/lib/ai-plan.ts";
import {
  createWorkoutSession,
  finishWorkoutSet,
  pauseWorkout,
  readWorkoutSession,
  recordWorkoutRep,
  startWorkoutSet,
  summarizeWorkout,
  undoWorkoutRep,
  validateWorkoutSearch,
  workoutSessionStorageKey,
  writeWorkoutSession,
} from "../src/lib/workout-session.ts";
import {
  getDashboardRecommendation,
  getQuickStartPlan,
  getWeeklyProgress,
} from "../src/lib/workout-plans.ts";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

test("guest recommendation transfers into a bounded plan, survives reload, and can end as a partial summary", () => {
  const recommendation = getQuickStartPlan({ best: 17, todayReps: 0, streak: 2, goal: 50 });
  assert.equal(recommendation.remaining, 50);
  assert.equal(recommendation.plannedReps, recommendation.sets * recommendation.reps);

  const search = validateWorkoutSearch({
    mode: "manual",
    sets: recommendation.sets,
    reps: recommendation.reps,
    rest_s: recommendation.rest_s,
    title: recommendation.title,
  });
  assert.deepEqual(search, {
    mode: "manual",
    sets: recommendation.sets,
    reps: recommendation.reps,
    rest_s: recommendation.rest_s,
    title: recommendation.title,
  });

  const storage = new MemoryStorage();
  const key = workoutSessionStorageKey("guest-1", "pushup");
  let session = createWorkoutSession(
    { sets: search.sets!, reps: search.reps!, restSeconds: search.rest_s!, title: search.title! },
    1_000,
  );
  assert.equal(session.phase, "preparation");
  assert.equal(writeWorkoutSession(storage, key, session), true);

  session = startWorkoutSet(session);
  const firstStartedAt = session.startedAt!;
  for (let i = 0; i < 5; i += 1) session = recordWorkoutRep(session);
  session = undoWorkoutRep(session); // correct an over-counted repetition
  assert.equal(session.currentReps, 4);

  session = finishWorkoutSet(session, 2_000);
  assert.equal(session.phase, "rest");
  assert.deepEqual(session.setReps, [4]);
  assert.equal(session.currentSet, 2);
  assert.equal(session.restEndsAt, 47_000);
  assert.equal(writeWorkoutSession(storage, key, session), true);

  session = pauseWorkout(session, firstStartedAt + 2_000);
  assert.equal(session.phase, "paused");
  assert.equal(session.elapsedBeforePauseMs, 2_000);
  assert.equal(session.restEndsAt, null);
  assert.equal(writeWorkoutSession(storage, key, session), true);

  // A fresh read from the same storage instance models the local-only reload recovery boundary.
  const recovered = readWorkoutSession(storage, key);
  assert.ok(recovered);
  assert.deepEqual(recovered, session);
  assert.deepEqual(recovered.setReps, [4]);
  assert.equal(recovered.currentSet, 2);
  assert.equal(recovered.partial, false);

  session = startWorkoutSet(recovered);
  assert.equal(session.phase, "active");
  assert.equal(session.currentReps, 0);
  for (let i = 0; i < 3; i += 1) session = recordWorkoutRep(session);
  session = finishWorkoutSet(session, 5_000);
  assert.equal(session.phase, "rest");
  assert.deepEqual(session.setReps, [4, 3]);

  const summary = summarizeWorkout(session, 6_000);
  assert.deepEqual(summary, {
    plannedSets: recommendation.sets,
    actualSets: 2,
    plannedReps: recommendation.plannedReps,
    actualReps: 7,
    plannedDurationMs: null,
    actualDurationMs: 2_000,
    partial: true,
  });
});

test("finishing every set produces a completed, non-partial summary", () => {
  let session = createWorkoutSession(
    { sets: 2, reps: 4, restSeconds: 30, title: "Kurzprogramm" },
    1_000,
  );
  session = startWorkoutSet(session);
  const startedAt = session.startedAt!;
  for (let i = 0; i < 4; i += 1) session = recordWorkoutRep(session);
  session = finishWorkoutSet(session, 2_000);
  assert.equal(session.phase, "rest");

  session = startWorkoutSet(session);
  for (let i = 0; i < 3; i += 1) session = recordWorkoutRep(session);
  session = finishWorkoutSet(session, 3_000);
  assert.equal(session.phase, "completed");

  assert.deepEqual(summarizeWorkout(session, startedAt + 6_000), {
    plannedSets: 2,
    actualSets: 2,
    plannedReps: 8,
    actualReps: 7,
    plannedDurationMs: null,
    actualDurationMs: 6_000,
    partial: false,
  });
});

test("pause and resume followed by completion does not leave the final summary partial", () => {
  let session = createWorkoutSession(
    { sets: 2, reps: 2, restSeconds: 30, title: "Pausenfest" },
    1_000,
  );
  session = startWorkoutSet(session);
  session = recordWorkoutRep(recordWorkoutRep(session));
  session = pauseWorkout(session, session.startedAt! + 1_000);
  assert.equal(session.phase, "paused");

  session = startWorkoutSet(session);
  session = finishWorkoutSet(recordWorkoutRep(recordWorkoutRep(session)), 3_000);
  assert.equal(session.phase, "rest");

  session = startWorkoutSet(session);
  session = finishWorkoutSet(recordWorkoutRep(recordWorkoutRep(session)), 4_000);
  assert.equal(session.phase, "completed");
  assert.equal(summarizeWorkout(session, 5_000).partial, false);
});

test("AI recommendation and difficulty feedback can be transferred into a validated workout plan", () => {
  const raw = JSON.stringify({
    reply: "Hier ist dein Vorschlag.",
    plan: {
      title: "Sauberer Einstieg",
      exercise_id: "pushup",
      sets: 3,
      reps: 9,
      rest_s: 60,
      rationale: "Ein moderates Volumen für deine heutige Einheit.",
    },
  });
  const parsed = parseAiResponse(raw);
  assert.ok(parsed.plan);
  const adjusted = applyPlanFeedback(parsed.plan, "zu_leicht");
  const search = validateWorkoutSearch({
    sets: adjusted.sets,
    reps: adjusted.reps,
    rest_s: adjusted.rest_s,
    title: adjusted.title,
  });
  assert.deepEqual(search, {
    sets: 3,
    reps: 10,
    rest_s: 60,
    title: "Sauberer Einstieg",
  });
  const session = createWorkoutSession(
    { sets: search.sets!, reps: search.reps!, restSeconds: search.rest_s!, title: search.title! },
    1_000,
  );
  assert.equal(session.plan.reps, 10);
});

test("workout search validation enforces integer plan boundaries and caps total planned reps", () => {
  assert.deepEqual(
    validateWorkoutSearch({
      mode: "camera",
      sets: 20,
      reps: 50,
      rest_s: 600,
      title: ` ${"x".repeat(90)} `,
    }),
    { mode: "camera", sets: 20, reps: 50, rest_s: 600, title: "x".repeat(80) },
  );

  assert.deepEqual(validateWorkoutSearch({ sets: 1, reps: 1, rest_s: 0 }), {
    sets: 1,
    reps: 1,
    rest_s: 0,
  });
  assert.deepEqual(
    validateWorkoutSearch({ sets: 0, reps: 1, rest_s: -1, mode: "unknown", title: "  " }),
    {},
  );
  assert.deepEqual(validateWorkoutSearch({ sets: 21, reps: 1, rest_s: 601 }), {});
  assert.deepEqual(validateWorkoutSearch({ sets: 20, reps: 51 }), { sets: 20 });
  assert.deepEqual(validateWorkoutSearch({ sets: 2.5, reps: 4.5, rest_s: 1.2 }), {});
  assert.deepEqual(validateWorkoutSearch({ sets: true, reps: true, rest_s: true }), {});
});

test("empty weekly inputs do not acquire invented repetition counts", () => {
  assert.deepEqual(getWeeklyProgress({ weekReps: 0, target: 0 }), {
    weekReps: 0,
    target: 0,
    percent: 0,
    state: "behind",
    message: "Noch 0 Reps bis zum Wochenziel.",
  });

  const unavailableReadiness = getDashboardRecommendation({
    plan: getQuickStartPlan({ best: 0, todayReps: 0, streak: 0, goal: 50 }),
    readinessAvailable: false,
  });
  assert.match(unavailableReadiness.readinessNote, /noch nicht verfügbar/i);
  assert.doesNotMatch(unavailableReadiness.readinessNote, /readiness:/i);
});
