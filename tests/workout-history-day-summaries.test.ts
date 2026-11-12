import assert from "node:assert/strict";
import test from "node:test";
import { summarizeWorkoutDays, type HistoryWorkout } from "../src/lib/workout-history.ts";

const workout = (
  id: string,
  created_at: string,
  exercise_id: string,
  count: number,
): HistoryWorkout => ({ id, created_at, exercise_id, count });

test("groups in local calendar days per exercise, sums valid values and sorts deterministically", () => {
  const rows = [
    workout("a", "2026-05-02T08:00:00Z", "plank", 30),
    workout("b", "2026-05-02T11:00:00Z", "plank", Number.NaN),
    workout("c", "2026-05-02T12:00:00Z", "pushup", 10),
    workout("d", "2026-05-01T12:00:00Z", "plank", 20),
    workout("e", "not-a-date", "plank", 999),
  ];
  const summaries = summarizeWorkoutDays(rows);
  assert.deepEqual(
    summaries.map(({ day, exerciseId, sessions, total, unit }) => ({
      day,
      exerciseId,
      sessions,
      total,
      unit,
    })),
    [
      { day: "2026-05-02", exerciseId: "pushup", sessions: 1, total: 10, unit: "reps" },
      { day: "2026-05-02", exerciseId: "plank", sessions: 2, total: 30, unit: "seconds" },
      { day: "2026-05-01", exerciseId: "plank", sessions: 1, total: 20, unit: "seconds" },
    ],
  );
});

test("preserves unknown exercise names and excludes invalid numeric values from totals", () => {
  const summaries = summarizeWorkoutDays([
    workout("a", "2026-05-01T12:00:00Z", "cali_odd_move", -1),
    workout("b", "2026-05-01T13:00:00Z", "cali_odd_move", Number.POSITIVE_INFINITY),
  ]);
  assert.deepEqual(summaries, [
    {
      day: "2026-05-01",
      exerciseId: "cali_odd_move",
      name: "odd move",
      unit: null,
      sessions: 2,
      total: 0,
    },
  ]);
});

test("workout history heatmap exposes each date and total without relying on hover", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(
    new URL("../src/components/WorkoutHistory.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /Trainingsaktivität nach Tag der letzten fünf Wochen/);
  assert.match(source, /role="img"/);
  assert.match(source, /aria-label=\{`\$\{d\}: \$\{reps\} Wiederholungen`\}/);
  assert.match(source, /<p className="text-xs text-muted-foreground">/);
});
