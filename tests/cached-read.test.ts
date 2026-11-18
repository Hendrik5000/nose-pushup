import assert from "node:assert/strict";
import { test } from "node:test";
import { cachedRead, resetCachedReadsForTests } from "../src/lib/cached-read.ts";

test("cachedRead deduplicates concurrent calls and caches within the TTL", async () => {
  resetCachedReadsForTests();
  let calls = 0;
  let clock = 1_000;
  const now = () => clock;
  const loader = async () => {
    calls += 1;
    return { value: calls };
  };

  const [first, second] = await Promise.all([
    cachedRead("k1", 10_000, loader, now),
    cachedRead("k1", 10_000, loader, now),
  ]);
  assert.equal(first.value, 1);
  assert.deepEqual(second, { value: 1 });
  assert.equal(calls, 1);

  const third = await cachedRead("k1", 10_000, loader, now);
  assert.deepEqual(third, { value: 1 }, "innerhalb der TTL kein neuer Abruf");
  assert.equal(calls, 1);

  clock += 10_001;
  const fourth = await cachedRead("k1", 10_000, loader, now);
  assert.deepEqual(fourth, { value: 2 }, "nach Ablauf der TTL wird neu geladen");
  assert.equal(calls, 2);
});

test("cachedRead caches per key and removes expired entries independently", async () => {
  resetCachedReadsForTests();
  let clock = 500;
  const now = () => clock;
  let aCalls = 0;
  let bCalls = 0;
  await cachedRead(
    "key-a",
    5_000,
    async () => {
      aCalls += 1;
      return "a";
    },
    now,
  );
  await cachedRead(
    "key-b",
    1_000,
    async () => {
      bCalls += 1;
      return "b";
    },
    now,
  );
  assert.equal(aCalls, 1);
  assert.equal(bCalls, 1);

  clock += 1_001;
  await cachedRead(
    "key-a",
    5_000,
    async () => {
      aCalls += 1;
      return "a2";
    },
    now,
  );
  await cachedRead(
    "key-b",
    1_000,
    async () => {
      bCalls += 1;
      return "b2";
    },
    now,
  );
  assert.equal(aCalls, 1, "key-a noch gültig");
  assert.equal(bCalls, 2, "key-b abgelaufen");
});

test("a failed loader is not cached and removes the inflight entry", async () => {
  resetCachedReadsForTests();
  const now = () => 1_000;
  let attempts = 0;
  const failing = cachedRead(
    "boom",
    10_000,
    async () => {
      attempts += 1;
      throw new Error("boom");
    },
    now,
  );
  await assert.rejects(failing, /boom/);

  const recovered = await cachedRead(
    "boom",
    10_000,
    async () => {
      attempts += 1;
      return "ok";
    },
    now,
  );
  assert.equal(recovered, "ok");
  assert.equal(attempts, 2);
});
