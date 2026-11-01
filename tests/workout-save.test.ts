import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  captureWorkoutDraft,
  clearPendingWorkoutSaveContext,
  finalizeWorkoutSave,
  nextWorkoutContextGeneration,
  pendingWorkoutSaveCache,
  resolvePendingWorkoutSaveIdentity,
  unplannedWorkoutDraftKey,
  workoutContextKey,
  workoutContextToken,
  workoutSaveIdentityLookupKey,
  type PendingWorkoutSaveIdentity,
} from "../src/lib/workout-save.ts";

class InMemoryStorage {
  values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

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

test("deferred queued success after navigation/unmount cleans only its original draft and reuses its identity", async () => {
  const storage = new InMemoryStorage();
  const key = "np-workout-session:user-a:pushup";
  const oldDraft = { id: "session-a", phase: "paused", reps: 4 };
  const oldRaw = JSON.stringify(oldDraft);
  storage.setItem(key, oldRaw);
  const captured = captureWorkoutDraft(storage, key, oldDraft);
  assert.equal(captured?.sessionSnapshot, oldRaw);

  const context = workoutContextKey("user-a", "pushup", {});
  const draftKey = oldDraft.id;
  const payloadKey = JSON.stringify({ count: 4, durationMs: 9000 });
  const lookupKey = workoutSaveIdentityLookupKey(context, draftKey, payloadKey);
  let nextId = 0;
  const identity = resolvePendingWorkoutSaveIdentity(
    context,
    draftKey,
    payloadKey,
    null,
    () => `row-${++nextId}`,
    () => "created-once",
    9000,
  );
  pendingWorkoutSaveCache.set(lookupKey, identity);

  const network = deferred<{ outcome: "queued" }>();
  let metadataWrites = 0;
  const completion = network.promise.then(({ outcome }) =>
    finalizeWorkoutSave({
      outcome,
      storage,
      captured,
      identityLookupKey: lookupKey,
      uiCurrent: false,
      onConfirmedSuccess: () => metadataWrites++,
    }),
  );
  network.resolve({ outcome: "queued" });
  const result = await completion;

  assert.equal(result.draftRemoved, true);
  assert.equal(storage.getItem(key), null);
  assert.equal(metadataWrites, 1);
  assert.equal(pendingWorkoutSaveCache.get(lookupKey), identity);
  // A remounted manual-mode view of the same draft and payload keeps the same row UUID.
  const retry = resolvePendingWorkoutSaveIdentity(
    workoutContextKey("user-a", "pushup", {}),
    draftKey,
    payloadKey,
    pendingWorkoutSaveCache.get(lookupKey) ?? null,
    () => `row-${++nextId}`,
    () => "unexpected-new-time",
    99_000,
  );
  assert.equal(retry.id, identity.id);
  assert.equal(retry.durationMs, 9000);
  assert.equal(nextId, 1);
  assert.notEqual(
    resolvePendingWorkoutSaveIdentity(
      context,
      draftKey,
      JSON.stringify({ count: 5, durationMs: 9000 }),
      identity,
      () => `row-${++nextId}`,
      () => "new-intent",
      9000,
    ).id,
    identity.id,
  );
});

test("a changed persisted draft is preserved and the successful identity remains cached", () => {
  const storage = new InMemoryStorage();
  const key = "draft-key";
  const original = { id: "session-x", reps: 2 };
  storage.setItem(key, JSON.stringify(original));
  const captured = captureWorkoutDraft(storage, key, original);
  const newerRaw = JSON.stringify({ id: "session-x", reps: 3 });
  storage.setItem(key, newerRaw);
  const context = "user-exercise";
  const lookupKey = workoutSaveIdentityLookupKey(context, original.id, "payload");
  const identity: PendingWorkoutSaveIdentity = {
    contextKey: context,
    draftKey: original.id,
    payloadKey: "payload",
    id: "row-kept",
    createdAt: "time",
    durationMs: 1,
  };
  pendingWorkoutSaveCache.set(lookupKey, identity);
  let metadataWrites = 0;

  const result = finalizeWorkoutSave({
    outcome: "saved",
    storage,
    captured,
    identityLookupKey: lookupKey,
    uiCurrent: true,
    onConfirmedSuccess: () => metadataWrites++,
  });

  assert.equal(result.draftRemoved, false);
  assert.equal(result.uiDraftClosed, false);
  assert.equal(storage.getItem(key), newerRaw);
  assert.equal(metadataWrites, 1);
  assert.equal(pendingWorkoutSaveCache.get(lookupKey), identity);
});

test("errors do not clean drafts or cache; current queued success removes an unchanged draft and retires cache", () => {
  const storage = new InMemoryStorage();
  const key = "draft";
  const draft = { id: "session-q", reps: 8 };
  const raw = JSON.stringify(draft);
  storage.setItem(key, raw);
  const captured = captureWorkoutDraft(storage, key, draft);
  const context = "context-q";
  const lookupKey = workoutSaveIdentityLookupKey(context, draft.id, "payload-q");
  const identity: PendingWorkoutSaveIdentity = {
    contextKey: context,
    draftKey: draft.id,
    payloadKey: "payload-q",
    id: "row-q",
    createdAt: "time-q",
    durationMs: 2,
  };
  pendingWorkoutSaveCache.set(lookupKey, identity);
  let metadataWrites = 0;
  const failed = finalizeWorkoutSave({
    outcome: "error",
    storage,
    captured,
    identityLookupKey: lookupKey,
    uiCurrent: true,
    onConfirmedSuccess: () => metadataWrites++,
  });
  assert.deepEqual(failed, { draftRemoved: false, uiDraftClosed: false });
  assert.equal(storage.getItem(key), raw);
  assert.equal(metadataWrites, 0);
  assert.equal(pendingWorkoutSaveCache.get(lookupKey), identity);

  const queued = finalizeWorkoutSave({
    outcome: "queued",
    storage,
    captured,
    identityLookupKey: lookupKey,
    uiCurrent: true,
    onConfirmedSuccess: () => metadataWrites++,
  });
  assert.equal(queued.draftRemoved, true);
  assert.equal(storage.getItem(key), null);
  assert.equal(metadataWrites, 1);
  assert.equal(pendingWorkoutSaveCache.has(lookupKey), false);
});

test("cleanup and cache reset handle throwing storage methods defensively and only clear one draft", () => {
  const throwingStorage = {
    getItem() {
      throw new Error("blocked storage");
    },
    removeItem() {
      throw new Error("blocked storage");
    },
  };
  assert.equal(captureWorkoutDraft(throwingStorage, "x", { id: "x" }), null);
  assert.doesNotThrow(() =>
    finalizeWorkoutSave({
      outcome: "saved",
      storage: throwingStorage,
      captured: null,
      identityLookupKey: "missing",
      uiCurrent: true,
    }),
  );

  const context = "scoped-context";
  const sessionOne = {
    contextKey: context,
    draftKey: "one",
    payloadKey: "p",
    id: "1",
    createdAt: "t",
    durationMs: 1,
  };
  const sessionTwo = { ...sessionOne, draftKey: "two", id: "2" };
  const lookupOne = workoutSaveIdentityLookupKey(context, sessionOne.draftKey, "p");
  const lookupTwo = workoutSaveIdentityLookupKey(context, sessionTwo.draftKey, "p");
  pendingWorkoutSaveCache.set(lookupOne, sessionOne);
  pendingWorkoutSaveCache.set(lookupTwo, sessionTwo);
  clearPendingWorkoutSaveContext(context, "one");
  assert.equal(pendingWorkoutSaveCache.has(lookupOne), false);
  assert.equal(pendingWorkoutSaveCache.get(lookupTwo), sessionTwo);
  clearPendingWorkoutSaveContext(context);
  assert.equal(pendingWorkoutSaveCache.has(lookupTwo), false);
});

test("identical counts in a new free workout are not swallowed by an older cached save", () => {
  const first = unplannedWorkoutDraftKey(1, 0, "manual", "5");
  assert.equal(unplannedWorkoutDraftKey(1, 0, "manual", "5"), first);
  assert.notEqual(unplannedWorkoutDraftKey(1, 1, "manual", "5"), first);
  assert.notEqual(unplannedWorkoutDraftKey(2, 0, "manual", "5"), first);
});

test("optional storage cleanup cannot hide an already confirmed result in the current UI", () => {
  let confirmed = 0;
  const outcome = finalizeWorkoutSave({
    outcome: "saved",
    storage: null,
    captured: null,
    identityLookupKey: "blocked",
    uiCurrent: true,
    onConfirmedSuccess: () => confirmed++,
  });
  assert.equal(confirmed, 1);
  assert.equal(outcome.draftRemoved, false);
  const source = readFileSync(
    new URL("../src/routes/_authenticated/workout.$exerciseId.tsx", import.meta.url),
    "utf8",
  );
  assert.equal((source.match(/if \(!uiContextStillCurrent\) return;/g) ?? []).length, 2);
  assert.doesNotMatch(
    source,
    /if \(!uiContextStillCurrent \|\| !finalization\.uiDraftClosed\) return/,
  );
  const payloads = [...source.matchAll(/const payload = \{([\s\S]*?)\n {4}\};/g)];
  assert.equal(payloads.length, 2);
  for (const [, payload] of payloads) {
    assert.match(payload, /form_score:/);
    assert.match(payload, /clean_reps:/);
  }
});
