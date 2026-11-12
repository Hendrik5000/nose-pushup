import assert from "node:assert/strict";
import test from "node:test";
import {
  countTrainingWeekSessions,
  getTrainingWeekBounds,
  sumTrainingWeekReps,
} from "../src/lib/training-dates";

test("counts only saved workout rows within the current local Monday-to-Monday week", () => {
  const now = new Date(2026, 10, 4, 12, 0, 0);
  const { startInclusive, endExclusive } = getTrainingWeekBounds(now);
  const start = new Date(startInclusive);
  const end = new Date(endExclusive);
  const beforeStart = new Date(start.getTime() - 1).toISOString();
  const atStart = start.toISOString();
  const beforeEnd = new Date(end.getTime() - 1).toISOString();
  const atEnd = end.toISOString();

  assert.equal(
    countTrainingWeekSessions(
      [
        { count: 10, created_at: beforeStart },
        { count: 0, created_at: atStart },
        { count: null, created_at: beforeEnd },
        { count: 5, created_at: atEnd },
        { count: 5, created_at: null },
        { count: 5, created_at: "invalid" },
      ],
      now,
    ),
    2,
  );
});

test("keeps the existing repetition total independent from session counting", () => {
  const now = new Date(2026, 10, 4, 12, 0, 0);
  const sessions = [
    { count: 12, created_at: "2026-11-02T10:00:00.000Z" },
    { count: null, created_at: "2026-11-03T10:00:00.000Z" },
    { count: 8, created_at: "2026-11-04T10:00:00.000Z" },
  ];

  assert.equal(countTrainingWeekSessions(sessions, now), 3);
  assert.equal(sumTrainingWeekReps(sessions, now), 20);
});

test("the weekly saved-record summary states that it counts push-up entries", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(
    new URL("../src/components/TrainingDashboard.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /Liegestütz-Eintrag/);
  assert.match(source, /Liegestütz-Einträge/);
});
