import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  normalizeCircuit,
  readWorkoutCircuit,
  saveWorkoutCircuit,
  sideBalance,
  suggestNextRepTarget,
  timeBudgetRemainingSeconds,
  workoutCircuitStorageKey,
} from "../src/lib/workout-companion";

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");

afterEach(() => {
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
});

function mockStorage(blocked = false) {
  const values = new Map<string, string>();
  const localStorage = {
    getItem(key: string) {
      if (blocked) throw new Error("blocked");
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      if (blocked) throw new Error("blocked");
      values.set(key, value);
    },
  };
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage } });
  return values;
}

test("circuit plans contain only unique supported exercises and are capped at four", () => {
  assert.deepEqual(
    normalizeCircuit(["pushup", "situp", "invalid", "pushup", "squat", "plank", "burpee"]),
    ["pushup", "situp", "squat", "plank"],
  );
});

test("saved circuits are isolated per account and malformed data recovers empty", () => {
  const values = mockStorage();
  const plan = ["pushup", "squat"];
  assert.equal(saveWorkoutCircuit("user-a", plan), true);
  assert.deepEqual(readWorkoutCircuit("user-a"), plan);
  assert.deepEqual(readWorkoutCircuit("user-b"), []);
  assert.notEqual(workoutCircuitStorageKey("user/a"), workoutCircuitStorageKey("user-a"));
  values.set(workoutCircuitStorageKey("user-a"), "bad json");
  assert.deepEqual(readWorkoutCircuit("user-a"), []);
});

test("rep target changes by one within the chosen range based on effort", () => {
  assert.equal(suggestNextRepTarget(10, 8, 12, 5), 11);
  assert.equal(suggestNextRepTarget(10, 8, 12, 9), 9);
  assert.equal(suggestNextRepTarget(12, 8, 12, 6), 12);
  assert.equal(suggestNextRepTarget(8, 8, 12, 10), 8);
  assert.equal(suggestNextRepTarget(10, 12, 8, 7), null);
});

test("side balance safely reports left, right, and even counts", () => {
  assert.deepEqual(sideBalance(8, 5), { difference: 3, leading: "left" });
  assert.deepEqual(sideBalance(4, 7), { difference: 3, leading: "right" });
  assert.deepEqual(sideBalance(-1, 0), { difference: 0, leading: "even" });
});

test("time budget uses a bounded timestamp calculation and never goes negative", () => {
  assert.equal(timeBudgetRemainingSeconds(10, 1_000, 121_000), 480);
  assert.equal(timeBudgetRemainingSeconds(1, 0, 61_000), 0);
  assert.equal(timeBudgetRemainingSeconds(0, 0, 0), null);
});
