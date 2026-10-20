import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  nextWorkoutContextGeneration,
  resolvePendingWorkoutSaveIdentity,
  workoutContextKey,
  workoutContextToken,
  type PendingWorkoutSaveIdentity,
} from "../src/lib/workout-save.ts";

test("workout context key includes the user, exercise, and all search values deterministically", () => {
  assert.equal(
    workoutContextKey("user-a", "pushup", { mode: "manual", sets: 2 }),
    workoutContextKey("user-a", "pushup", { sets: 2, mode: "manual" }),
  );
  assert.notEqual(
    workoutContextKey("user-a", "pushup", { mode: "manual", sets: 2 }),
    workoutContextKey("user-a", "pushup", { mode: "nose", sets: 2 }),
  );
  assert.notEqual(
    workoutContextKey("user-a", "pushup", { mode: "manual" }),
    workoutContextKey("user-a", "squat", { mode: "manual" }),
  );
});

test("context generation distinguishes A to B to A and separate visits", () => {
  const a = workoutContextKey("user-a", "pushup", { mode: "nose" });
  const b = workoutContextKey("user-a", "pushup", { mode: "manual" });
  let context = { key: "", generation: 0 };
  context = nextWorkoutContextGeneration(context, a);
  const firstVisitToken = workoutContextToken(7, context);
  context = nextWorkoutContextGeneration(context, b);
  context = nextWorkoutContextGeneration(context, a);
  assert.equal(context.generation, 3);
  assert.notEqual(workoutContextToken(7, context), firstVisitToken);
  assert.notEqual(workoutContextToken(8, context), workoutContextToken(7, context));
  assert.equal(nextWorkoutContextGeneration(context, a), context);
});

test("a failed save retry retains its ID and timestamp for the same draft and payload", () => {
  let ids = 0;
  let timestamps = 0;
  const create = (existing: PendingWorkoutSaveIdentity | null, payloadKey = "count=5") =>
    resolvePendingWorkoutSaveIdentity(
      "visit:1:plan-A",
      "session-1",
      payloadKey,
      existing,
      () => `row-${++ids}`,
      () => `time-${++timestamps}`,
    );
  const first = create(null);
  const retry = create(first);
  assert.equal(retry, first);
  assert.equal(ids, 1);
  assert.equal(timestamps, 1);
});

test("a different context, draft, or immutable payload receives a new save identity", () => {
  let ids = 0;
  let timestamps = 0;
  const make = (
    contextKey: string,
    draftKey: string,
    payloadKey: string,
    existing: PendingWorkoutSaveIdentity | null,
  ) =>
    resolvePendingWorkoutSaveIdentity(
      contextKey,
      draftKey,
      payloadKey,
      existing,
      () => `row-${++ids}`,
      () => `time-${++timestamps}`,
    );
  const first = make("visit-a", "draft-a", "count=5", null);
  assert.notEqual(make("visit-b", "draft-a", "count=5", first).id, first.id);
  assert.notEqual(make("visit-a", "draft-b", "count=5", first).id, first.id);
  assert.notEqual(make("visit-a", "draft-a", "count=6", first).id, first.id);
  assert.equal(ids, 4);
  assert.equal(timestamps, 4);
});

test("elapsed clock changes do not change an unchanged retry's database row", () => {
  const pending = new Map<string, PendingWorkoutSaveIdentity>();
  let nextId = 0;
  const saveAttempt = (durationMs: number, count = 5) => {
    const payload = { user_id: "user-a", exercise_id: "pushup", count, rpe: 6 };
    const payloadKey = JSON.stringify(payload);
    const identityKey = JSON.stringify(["visit-a", "draft-a", payloadKey]);
    const identity = resolvePendingWorkoutSaveIdentity(
      "visit-a",
      "draft-a",
      payloadKey,
      pending.get(identityKey) ?? null,
      () => `row-${++nextId}`,
      () => `time-${nextId}`,
      durationMs,
    );
    pending.set(identityKey, identity);
    return {
      id: identity.id,
      ...payload,
      duration_ms: identity.durationMs,
      created_at: identity.createdAt,
    };
  };
  const first = saveAttempt(5_000);
  assert.deepEqual(saveAttempt(65_000), first);
  assert.equal(nextId, 1);
  const edited = saveAttempt(70_000, 6);
  assert.notEqual(edited.id, first.id);
  assert.equal(edited.duration_ms, 70_000);

  const source = readFileSync(
    new URL("../src/routes/_authenticated/workout.$exerciseId.tsx", import.meta.url),
    "utf8",
  );
  const signaturePayloads = [...source.matchAll(/const payload = \{([\s\S]*?)\n {4}\};/g)];
  assert.equal(signaturePayloads.length, 2);
  for (const [, payload] of signaturePayloads) assert.doesNotMatch(payload, /duration_ms/);
  assert.equal((source.match(/const duration_ms = pendingIdentity\.durationMs;/g) ?? []).length, 2);
});
