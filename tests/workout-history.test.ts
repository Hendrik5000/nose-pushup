import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { CALI_PATHS } from "../src/lib/calisthenics.ts";
import {
  historyExercise,
  loadWorkoutHistory,
  type HistoryWorkout,
} from "../src/lib/workout-history.ts";

const row = (index: number): HistoryWorkout => ({
  id: `test-only-${index}`,
  created_at: "2026-10-20T10:00:00Z",
  exercise_id: "pushup",
  count: 1,
});

test("history treats a successful empty page as empty, not failed or unavailable data", async () => {
  assert.deepEqual(await loadWorkoutHistory(async () => ({ data: [], error: null })), []);
  await assert.rejects(
    loadWorkoutHistory(async () => ({ data: null, error: null })),
    /nicht verfügbar/,
  );
  await assert.rejects(
    loadWorkoutHistory(async () => ({ data: [], error: new Error("offline") })),
    /nicht vollständig/,
  );
  await assert.rejects(
    loadWorkoutHistory(async () => {
      throw new Error("network rejected");
    }),
    /network rejected/,
  );
});

test("history uses bounded nonoverlapping pages and retains all rows", async () => {
  const calls: [number, number][] = [];
  const all = Array.from({ length: 501 }, (_, index) => row(index));
  const loaded = await loadWorkoutHistory(async (from, to) => {
    calls.push([from, to]);
    return { data: all.slice(from, to + 1), error: null };
  });
  assert.deepEqual(calls, [
    [0, 499],
    [500, 999],
  ]);
  assert.deepEqual(loaded, all);
});

test("a full final page requires a final empty read and a later failure never becomes partial success", async () => {
  const calls: number[] = [];
  const fullPage = Array.from({ length: 500 }, (_, index) => row(index));
  assert.equal(
    (
      await loadWorkoutHistory(async (from) => {
        calls.push(from);
        return { data: from === 0 ? fullPage : [], error: null };
      })
    )?.length,
    500,
  );
  assert.deepEqual(calls, [0, 500]);
  await assert.rejects(
    loadWorkoutHistory(async (from) => ({
      data: from === 0 ? fullPage : null,
      error: from === 0 ? null : new Error("page 2 failed"),
    })),
    /nicht vollständig/,
  );
});

test("cancelled histories perform no further reads and do not return another account's data", async () => {
  let cancelled = true;
  let calls = 0;
  assert.equal(
    await loadWorkoutHistory(
      async () => {
        calls += 1;
        return { data: [row(0)], error: null };
      },
      () => cancelled,
    ),
    null,
  );
  assert.equal(calls, 0);
  cancelled = false;
  const result = await loadWorkoutHistory(
    async () => {
      calls += 1;
      cancelled = true;
      return { data: Array.from({ length: 500 }, (_, index) => row(index)), error: null };
    },
    () => cancelled,
  );
  assert.equal(result, null);
  assert.equal(calls, 1);
});

test("history uses real units for plank and every Calisthenics skill, including rep exercises", () => {
  assert.deepEqual(historyExercise("plank"), { name: "Plank", unit: "seconds" });
  assert.deepEqual(historyExercise("pushup"), { name: "Liegestütze", unit: "reps" });
  assert.equal(historyExercise("cali_pseudo_pushup").unit, "reps");
  assert.equal(historyExercise("cali_hs_pushup").unit, "reps");
  for (const path of CALI_PATHS) {
    for (const skill of path.skills)
      assert.deepEqual(historyExercise(skill.id), { name: skill.name, unit: skill.unit });
  }
  assert.equal(historyExercise("cali_unknown").unit, null);
  for (const id of ["constructor", "__proto__", "toString"])
    assert.equal(historyExercise(id).unit, null);
  for (const id of [null, undefined, ""])
    assert.deepEqual(historyExercise(id), { name: "Training", unit: null });
});

test("history component resets on account changes, ignores stale responses and offers retry", () => {
  const source = readFileSync(
    new URL("../src/components/WorkoutHistory.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /history\.ownerId === userId && history\.status === "ready"/);
  assert.match(source, /if \(!cancelled && rows !== null\)/);
  assert.match(source, /cancelled = true/);
  assert.match(source, /\[userId, attempt\]/);
  assert.match(source, /Erneut versuchen/);
  assert.match(source, /In den letzten 35 Tagen/);
  assert.doesNotMatch(source, /Speichere dein erstes Training/);
  assert.doesNotMatch(source, /exercise_id\.startsWith\("cali_"\) \|\|/);
});
