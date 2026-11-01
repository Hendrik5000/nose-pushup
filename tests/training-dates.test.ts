import assert from "node:assert/strict";
import test from "node:test";
import {
  getTrainingWeekBounds,
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
