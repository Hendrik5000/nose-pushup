import assert from "node:assert/strict";
import test from "node:test";
import {
  addLocalDays,
  countUniqueGymDays,
  localDateFromKey,
  localDayKey,
  mondayFirstMonthGrid,
  mondayWeekRange,
  monthDayRange,
} from "../src/lib/gym-calendar.ts";

test("month range and Monday-first grid include leap day and pad calendar weeks", () => {
  const february = new Date(2024, 1, 15, 12);
  assert.deepEqual(monthDayRange(february), { startDay: "2024-02-01", endDay: "2024-02-29" });
  const grid = mondayFirstMonthGrid(february);
  assert.equal(grid.length, 42);
  assert.equal(grid[0], null); // February 1, 2024 was Thursday.
  assert.equal(grid[3], "2024-02-01");
  assert.equal(grid[31], "2024-02-29");
  assert.equal(grid.filter((day) => day !== null).length, 29);
});

test("Sunday and Monday fall into the same Monday-to-Sunday week", () => {
  assert.deepEqual(mondayWeekRange(new Date(2024, 0, 7, 23, 30)), {
    startDay: "2024-01-01",
    endDay: "2024-01-07",
  });
  assert.deepEqual(mondayWeekRange(new Date(2024, 0, 8, 0, 1)), {
    startDay: "2024-01-08",
    endDay: "2024-01-14",
  });
});

test("month and week helpers handle year transitions", () => {
  assert.deepEqual(monthDayRange(new Date(2025, 0, 12, 12)), {
    startDay: "2025-01-01",
    endDay: "2025-01-31",
  });
  assert.deepEqual(mondayWeekRange(new Date(2024, 11, 31, 12)), {
    startDay: "2024-12-30",
    endDay: "2025-01-05",
  });
});

test("local keys remain stable across DST and never shift through UTC", () => {
  const previousTimezone = process.env.TZ;
  process.env.TZ = "America/Los_Angeles";
  try {
    const lateLocalDay = new Date(2025, 2, 8, 23, 45);
    assert.equal(localDayKey(lateLocalDay), "2025-03-08");
    const afterSpringForward = addLocalDays(lateLocalDay, 2);
    assert.equal(localDayKey(afterSpringForward), "2025-03-10");
    assert.equal(afterSpringForward.getHours(), 12);
    assert.equal(localDayKey(localDateFromKey("2025-03-09")!), "2025-03-09");
    assert.equal(localDateFromKey("2025-02-29"), null);
  } finally {
    if (previousTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimezone;
  }
});

test("visit frequency counts unique valid days within inclusive bounds only", () => {
  assert.equal(
    countUniqueGymDays(
      ["2024-01-01", "2024-01-01", "2024-01-07", "2024-01-08", "2024-02-30", "bad"],
      "2024-01-01",
      "2024-01-07",
    ),
    2,
  );
});
