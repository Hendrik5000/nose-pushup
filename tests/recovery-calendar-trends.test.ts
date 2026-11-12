import assert from "node:assert/strict";
import test from "node:test";
import {
  summarizeJointLoadTrend,
  summarizeJoints,
  type DayLoad,
} from "../src/lib/recovery-calendar";

function week(loads: number[], days?: string[]): DayLoad[] {
  return loads.map((load, index) => ({
    day: days?.[index] ?? `2026-11-${String(index + 1).padStart(2, "0")}`,
    loads: { wrist: load, shoulder: 0, elbow: 0, core: 0 },
    soreness: null,
  }));
}

test("reports consecutive recent load days and direction from ordered daily values", () => {
  assert.deepEqual(summarizeJointLoadTrend(week([1, 1, 2]), "wrist"), {
    consecutiveLoadDays: 3,
    direction: "steigend",
  });
  assert.deepEqual(summarizeJointLoadTrend(week([2, 2]), "wrist"), {
    consecutiveLoadDays: 2,
    direction: "gleich",
  });
  assert.deepEqual(summarizeJointLoadTrend(week([3, 1]), "wrist"), {
    consecutiveLoadDays: 2,
    direction: "abnehmend",
  });
});

test("zero-load weeks are zero and decreasing; zero days reset the recent run", () => {
  assert.deepEqual(summarizeJointLoadTrend(week([0, 0, 0]), "wrist"), {
    consecutiveLoadDays: 0,
    direction: "abnehmend",
  });
  assert.deepEqual(summarizeJointLoadTrend(week([1, 0, 2]), "wrist"), {
    consecutiveLoadDays: 1,
    direction: "steigend",
  });
});

test("calendar gaps reset the run and malformed ordering or values fail safely", () => {
  assert.deepEqual(summarizeJointLoadTrend(week([1, 1], ["2026-11-01", "2026-11-03"]), "wrist"), {
    consecutiveLoadDays: 1,
    direction: "abnehmend",
  });
  assert.deepEqual(summarizeJointLoadTrend(week([1, 2], ["2026-11-02", "2026-11-01"]), "wrist"), {
    consecutiveLoadDays: 0,
    direction: "abnehmend",
  });
  const missing = week([1]);
  (missing[0].loads as Partial<DayLoad["loads"]>).wrist = undefined;
  assert.deepEqual(summarizeJointLoadTrend(missing, "wrist"), {
    consecutiveLoadDays: 0,
    direction: "abnehmend",
  });
  assert.deepEqual(summarizeJointLoadTrend(week([Number.NaN]), "wrist"), {
    consecutiveLoadDays: 0,
    direction: "abnehmend",
  });
  assert.deepEqual(summarizeJointLoadTrend([], "wrist"), {
    consecutiveLoadDays: 0,
    direction: "abnehmend",
  });
});

test("trend calculation does not alter existing scores", () => {
  const days = week([1, 2]);
  const before = summarizeJoints(days);
  summarizeJointLoadTrend(days, "wrist");
  assert.deepEqual(summarizeJoints(days), before);
});

test("calendar trends and daily load bars remain readable and exposed to assistive technology", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(
    new URL("../src/components/RecoveryCalendar.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /grid-cols-2 gap-2 sm:grid-cols-4/);
  assert.match(source, /role="list"/);
  assert.match(source, /role="listitem"/);
  assert.match(source, /Belastungseinheiten/);
  assert.match(source, /text-xs leading-snug/);
});
