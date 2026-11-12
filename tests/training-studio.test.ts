import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildTrainingStudioInsights,
  DEFAULT_TRAINING_STUDIO_GOALS,
  loadTrainingStudioGoals,
  normalizeTrainingStudioGoals,
  saveTrainingStudioGoals,
  trainingStudioCalendarDayDifference,
  trainingStudioGroups,
  trainingStudioStorageKey,
  type TrainingStudioGoals,
} from "../src/lib/training-studio.ts";
import type { HistoryWorkout } from "../src/lib/workout-history.ts";

const now = new Date("2026-11-12T12:00:00");
const row = (id: string, day: string, exercise_id: string, count: number): HistoryWorkout => ({
  id,
  created_at: `${day}T09:30:00`,
  exercise_id,
  count,
});

class MemoryStorage {
  data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

const rows: HistoryWorkout[] = [
  row("p1", "2026-11-12", "pushup", 10),
  row("p2", "2026-11-11", "pushup", 8),
  row("t1", "2026-11-10", "plank", 20),
];

function itemValue(insights: ReturnType<typeof buildTrainingStudioInsights>, id: number) {
  return insights.find((item) => item.id === `studio-${id}`)?.value;
}

test("the Training Studio provides exactly 50 unique insights in five groups of ten", () => {
  const insights = buildTrainingStudioInsights(rows, 35, DEFAULT_TRAINING_STUDIO_GOALS, now);
  const groups = trainingStudioGroups(insights);
  assert.equal(insights.length, 50);
  assert.equal(new Set(insights.map((item) => item.id)).size, 50);
  assert.equal(new Set(insights.map((item) => item.label)).size, 50);
  assert.deepEqual(
    groups.map((group) => group.insights.length),
    [10, 10, 10, 10, 10],
  );
  assert.equal(groups[0].label, "Leistung & Verlauf");
  assert.equal(groups[4].label, "Hinweise & Transparenz");
});

test("insights count saved sessions and keep repetitions separate from timed exercises", () => {
  const insights = buildTrainingStudioInsights(rows, 35, DEFAULT_TRAINING_STUDIO_GOALS, now);
  assert.equal(itemValue(insights, 1), "3");
  assert.equal(itemValue(insights, 3), "18");
  assert.equal(itemValue(insights, 4), "20 Sek.");
  assert.equal(itemValue(insights, 5), "9");
  assert.equal(itemValue(insights, 6), "9");
  assert.notEqual(itemValue(insights, 7), "—");
  assert.equal(itemValue(insights, 8), "8");
  assert.equal(itemValue(insights, 14), "3 Tage");
  assert.equal(itemValue(insights, 15), "3 Tage");
  assert.equal(itemValue(insights, 20), "3");
  assert.equal(itemValue(insights, 27), "2");
  assert.equal(itemValue(insights, 26), "10");
  assert.equal(itemValue(insights, 34), "20 %");
  assert.equal(itemValue(insights, 48), "0");
  assert.equal(itemValue(insights, 43), "Neu");
  assert.equal(itemValue(insights, 44), "9");
  assert.equal(itemValue(insights, 47), "Morgens · 3 Einheiten");
  assert.equal(itemValue(insights, 49), "3 gültige · 0 ausgelassen");
});

test("malformed workout rows are excluded from metrics and reported transparently", () => {
  const malformed = [
    ...rows,
    null as unknown as HistoryWorkout,
    row("bad-count", "2026-11-12", "pushup", -1),
    row("bad-decimal", "2026-11-12", "pushup", 1.5),
    { ...row("bad-date", "2026-11-12", "pushup", 3), created_at: "not-a-date" },
    { ...row("bad-id", "2026-11-12", "", 3) },
  ];
  const insights = buildTrainingStudioInsights(malformed, 35, DEFAULT_TRAINING_STUDIO_GOALS, now);
  assert.equal(itemValue(insights, 1), "3");
  assert.equal(itemValue(insights, 3), "18");
  assert.equal(itemValue(insights, 49), "3 gültige · 5 ausgelassen");
});

test("an empty history still gives honest unavailable values and all 50 features", () => {
  const insights = buildTrainingStudioInsights([], 35, DEFAULT_TRAINING_STUDIO_GOALS, now);
  assert.equal(insights.length, 50);
  assert.equal(itemValue(insights, 1), "0");
  assert.equal(itemValue(insights, 7), "—");
  assert.equal(itemValue(insights, 10), "—");
  assert.equal(itemValue(insights, 26), "—");
  assert.equal(itemValue(insights, 18), "—");
  assert.equal(itemValue(insights, 34), "—");
  assert.equal(itemValue(insights, 35), "—");
  assert.equal(itemValue(insights, 36), "—");
  assert.equal(itemValue(insights, 37), "—");
  assert.equal(itemValue(insights, 48), "—");
  assert.equal(itemValue(insights, 49), "Noch keine gültigen Einträge");
  assert.match(itemValue(insights, 50) ?? "", /keine gültigen/);
});

test("comparison insights use fixed recent windows and disclose absent comparison data", () => {
  const prior = row("p0", "2026-10-31", "pushup", 5);
  const recent = row("p3", "2026-11-05", "pushup", 10);
  const insights = buildTrainingStudioInsights(
    [...rows, prior, recent],
    35,
    DEFAULT_TRAINING_STUDIO_GOALS,
    now,
  );
  assert.equal(itemValue(insights, 28), "Neu");
  assert.equal(itemValue(insights, 42), "+20 %");
  assert.equal(itemValue(insights, 43), "Neu");
  assert.match(
    insights.find((item) => item.id === "studio-43")?.detail ?? "",
    /Höchster Einzelwert/,
  );
  const noData = buildTrainingStudioInsights([], 0, DEFAULT_TRAINING_STUDIO_GOALS, now);
  assert.equal(noData.length, 50);
});

test("calendar-day differences stay correct across daylight-saving transitions", () => {
  assert.equal(trainingStudioCalendarDayDifference("2026-03-29", "2026-03-30"), 1);
  assert.equal(trainingStudioCalendarDayDifference("2026-10-25", "2026-10-26"), 1);
  assert.equal(trainingStudioCalendarDayDifference("2026-10-24", "2026-10-26"), 2);
  assert.ok(Number.isNaN(trainingStudioCalendarDayDifference("invalid", "2026-11-12")));
});

test("goal projections require four weeks of distributed data and a positive trend", () => {
  const goals = { ...DEFAULT_TRAINING_STUDIO_GOALS, focusBestTarget: 100 };
  const sameDay = [
    row("same-1", "2026-11-12", "pushup", 10),
    row("same-2", "2026-11-12", "pushup", 15),
    row("same-3", "2026-11-12", "pushup", 20),
    row("same-4", "2026-11-12", "pushup", 25),
  ];
  assert.equal(itemValue(buildTrainingStudioInsights(sameDay, 35, goals, now), 37), "—");

  const rising = [
    row("rise-1", "2026-10-12", "pushup", 10),
    row("rise-2", "2026-10-19", "pushup", 15),
    row("rise-3", "2026-10-26", "pushup", 20),
    row("rise-4", "2026-11-09", "pushup", 25),
  ];
  assert.notEqual(itemValue(buildTrainingStudioInsights(rising, 35, goals, now), 37), "—");

  const falling = rising.map((item) => ({ ...item, count: 35 - item.count }));
  assert.equal(itemValue(buildTrainingStudioInsights(falling, 35, goals, now), 37), "—");
});

test("goal normalization bounds values and accepts only safe local exercise identifiers", () => {
  const normalized = normalizeTrainingStudioGoals({
    weeklySessionTarget: 99,
    focusExerciseId: "../../not-safe",
    focusBestTarget: -4,
    targetDate: "2026-02-31",
  });
  assert.deepEqual(normalized, DEFAULT_TRAINING_STUDIO_GOALS);
  assert.equal(
    normalizeTrainingStudioGoals({
      weeklySessionTarget: 5,
      focusExerciseId: "cali_hs_pushup",
      focusBestTarget: 200,
      targetDate: "2026-12-31",
    }).focusExerciseId,
    "cali_hs_pushup",
  );
});

test("local goals are isolated by account and round-trip safely", () => {
  const storage = new MemoryStorage();
  const alice: TrainingStudioGoals = {
    weeklySessionTarget: 4,
    focusExerciseId: "pushup",
    focusBestTarget: 30,
    targetDate: "2026-12-31",
  };
  const bob: TrainingStudioGoals = {
    weeklySessionTarget: 2,
    focusExerciseId: "plank",
    focusBestTarget: 90,
    targetDate: "",
  };
  assert.equal(saveTrainingStudioGoals(storage, "alice", alice), true);
  assert.equal(saveTrainingStudioGoals(storage, "bob", bob), true);
  assert.deepEqual(loadTrainingStudioGoals(storage, "alice"), alice);
  assert.deepEqual(loadTrainingStudioGoals(storage, "bob"), bob);
});

test("unavailable browser storage falls back safely and invalid account ids cannot be written", () => {
  const denied = {
    getItem() {
      throw new Error("storage denied");
    },
    setItem() {
      throw new Error("storage denied");
    },
    removeItem() {
      throw new Error("storage denied");
    },
  };
  assert.deepEqual(loadTrainingStudioGoals(denied, "alice"), DEFAULT_TRAINING_STUDIO_GOALS);
  assert.equal(saveTrainingStudioGoals(denied, "alice", DEFAULT_TRAINING_STUDIO_GOALS), false);
  const storage = new MemoryStorage();
  assert.equal(saveTrainingStudioGoals(storage, "", DEFAULT_TRAINING_STUDIO_GOALS), false);
});

test("the Studio is progressive disclosure, reuses loaded history, and adds no database route or write", () => {
  const source = readFileSync(
    new URL("../src/components/TrainingStudio.tsx", import.meta.url),
    "utf8",
  );
  const history = readFileSync(
    new URL("../src/components/WorkoutHistory.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /<details className=/);
  assert.match(source, /rows:\s*readonly HistoryWorkout\[\]/);
  assert.match(source, /loadedUserId/);
  assert.match(source, /disabled=\{!goalsReady\}/);
  assert.match(source, /if \(!goalsReady\) return;/);
  assert.doesNotMatch(source, /Ziele zurücksetzen|resetTrainingStudioGoals/);
  assert.doesNotMatch(source, /supabase|\.from\(|\.insert\(|\.update\(|\.upsert\(/);
  assert.match(source, /Kurzzusammenfassung kopieren/);
  assert.match(source, /navigator\.clipboard/);
  assert.match(
    history,
    /<TrainingStudio userId=\{userId\} rows=\{recentWorkouts\} rangeDays=\{rangeDays\} \/>/,
  );
  assert.match(history, /<option value=\{180\}>180 Tage<\/option>/);
  assert.match(history, /flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between/);
  assert.match(history, /flex flex-wrap gap-x-3 gap-y-1/);
  assert.doesNotMatch(history, /\.insert\(|\.update\(|\.upsert\(/);
});
