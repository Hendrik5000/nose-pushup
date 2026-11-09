import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { compareWorkoutWeeks } from "../src/lib/workout-week-comparison.ts";
import type { HistoryWorkout } from "../src/lib/workout-history.ts";

function workout(
  day: string,
  exercise_id: string,
  count: number,
  id = `${day}-${exercise_id}`,
): HistoryWorkout {
  return {
    id,
    created_at: new Date(`${day}T12:00:00`).toISOString(),
    exercise_id,
    count,
  };
}

test("week comparison uses the same elapsed weekdays and keeps exercise units separate", () => {
  const rows = [
    workout("2026-11-09", "pushup", 12),
    workout("2026-11-10", "pushup", 5),
    workout("2026-11-02", "pushup", 10),
    workout("2026-11-04", "pushup", 8),
    workout("2026-11-09", "plank", 60),
    workout("2026-11-03", "plank", 30),
    workout("2026-11-05", "pushup", 100), // Same prior week, but not an elapsed weekday.
    workout("2026-11-08", "pushup", 100), // Prior Sunday is not part of the comparison.
    workout("2026-11-12", "pushup", 100), // Future day in the current week.
    { ...workout("2026-11-10", "pushup", -2), id: "negative" },
    { ...workout("2026-11-10", "pushup", Number.NaN), id: "not-a-number" },
    { ...workout("2026-11-10", "pushup", 99), created_at: "invalid", id: "invalid-date" },
  ];

  const result = compareWorkoutWeeks(rows, new Date(2026, 10, 11, 15));
  const pushups = result.find(({ exerciseId }) => exerciseId === "pushup");
  const plank = result.find(({ exerciseId }) => exerciseId === "plank");

  assert.deepEqual(pushups, {
    exerciseId: "pushup",
    name: "Liegestütze",
    unit: "reps",
    current: 17,
    previous: 18,
    change: -1,
  });
  assert.deepEqual(plank, {
    exerciseId: "plank",
    name: "Plank",
    unit: "seconds",
    current: 60,
    previous: 30,
    change: 30,
  });
  assert.equal(result.length, 2);
});

test("Monday compares only Monday so far and excludes Sunday and future weekdays", () => {
  const rows = [
    workout("2026-11-09", "pushup", 3),
    workout("2026-11-02", "pushup", 8),
    workout("2026-11-08", "pushup", 40),
    workout("2026-11-10", "pushup", 40),
  ];
  const [comparison] = compareWorkoutWeeks(rows, new Date(2026, 10, 9, 10));
  assert.equal(comparison.current, 3);
  assert.equal(comparison.previous, 8);
  assert.equal(comparison.change, -5);
});

test("a zero previous-week total stays an absolute comparison rather than a percentage", () => {
  const rows = [workout("2026-11-09", "pushup", 6)];
  const [comparison] = compareWorkoutWeeks(rows, new Date(2026, 10, 11, 10));
  assert.equal(comparison.current, 6);
  assert.equal(comparison.previous, 0);
  assert.equal(comparison.change, 6);
  assert.equal("percentChange" in comparison, false);
});

test("history exposes an accessible comparison without changing its account-scoped query", () => {
  const source = readFileSync(
    new URL("../src/components/WorkoutHistory.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /aria-label="Wochenvergleich pro Übung"/);
  assert.match(source, /Diese Woche bis heute/);
  assert.match(source, /denselben Wochentagen der Vorwoche/);
  assert.match(source, /compareWorkoutWeeks\(filteredSessions\)/);
  assert.match(source, /\.eq\("user_id", userId\)/);
  const comparisonBlock = source.slice(
    source.indexOf('<section aria-label="Wochenvergleich pro Übung"'),
    source.indexOf("</section>", source.indexOf('<section aria-label="Wochenvergleich pro Übung"')),
  );
  assert.doesNotMatch(comparisonBlock, /%/);
});
