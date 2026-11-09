import assert from "node:assert/strict";
import test from "node:test";
import {
  getTrainingWeekBounds,
  getTrainingWeekDailyReps,
  localDateKey,
  sumTrainingWeekReps,
} from "../src/lib/training-dates.ts";

test("week starts at Monday midnight in local calendar time", () => {
  const mondayNoon = new Date(2024, 0, 8, 12, 34, 0);
  const bounds = getTrainingWeekBounds(mondayNoon);
  assert.equal(bounds.startDay, "2024-01-08");
  assert.equal(bounds.endDayExclusive, "2024-01-15");
  assert.equal(bounds.startInclusive, new Date(2024, 0, 8, 0, 0, 0).toISOString());
  assert.equal(bounds.endExclusive, new Date(2024, 0, 15, 0, 0, 0).toISOString());
  assert.equal(localDateKey(new Date(2024, 0, 14, 23, 59)), "2024-01-14");
});

test("weekly reps sum actual saved counts inside the local Monday-to-Monday window", () => {
  const now = new Date(2024, 0, 10, 12);
  const bounds = getTrainingWeekBounds(now);
  const records = [
    { count: 15, created_at: bounds.startInclusive },
    { count: 30, created_at: new Date(2024, 0, 14, 23, 59).toISOString() },
    {
      count: 99,
      created_at: new Date(2024, 0, 7, 23, 59, 59).toISOString(),
    },
    { count: 200, created_at: bounds.endExclusive },
    { count: null, created_at: bounds.startInclusive },
    { count: 40, created_at: "not a timestamp" },
  ];
  assert.equal(sumTrainingWeekReps(records, now), 45);
});

test("daily reps are bucketed Monday through Sunday by local saved date", () => {
  const now = new Date(2024, 0, 10, 12);
  const records = [
    { count: 5, created_at: new Date(2024, 0, 8, 0, 0).toISOString() },
    { count: 3, created_at: new Date(2024, 0, 8, 23, 59).toISOString() },
    { count: 7, created_at: new Date(2024, 0, 9, 0, 0).toISOString() },
    { count: 11, created_at: new Date(2024, 0, 14, 23, 59).toISOString() },
    { count: 99, created_at: new Date(2024, 0, 15, 0, 0).toISOString() },
    { count: -2, created_at: new Date(2024, 0, 10, 10).toISOString() },
    { count: null, created_at: new Date(2024, 0, 10, 11).toISOString() },
    { count: 20, created_at: "not a timestamp" },
  ];

  const days = getTrainingWeekDailyReps(records, now);
  assert.deepEqual(
    days.map(({ dateKey, reps, isToday, isFuture }) => ({ dateKey, reps, isToday, isFuture })),
    [
      { dateKey: "2024-01-08", reps: 8, isToday: false, isFuture: false },
      { dateKey: "2024-01-09", reps: 7, isToday: false, isFuture: false },
      { dateKey: "2024-01-10", reps: 0, isToday: true, isFuture: false },
      { dateKey: "2024-01-11", reps: 0, isToday: false, isFuture: true },
      { dateKey: "2024-01-12", reps: 0, isToday: false, isFuture: true },
      { dateKey: "2024-01-13", reps: 0, isToday: false, isFuture: true },
      { dateKey: "2024-01-14", reps: 11, isToday: false, isFuture: true },
    ],
  );
  assert.equal(sumTrainingWeekReps(records, now), 26);
  assert.equal(getTrainingWeekDailyReps([], now).length, 7);
});
