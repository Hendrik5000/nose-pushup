import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildHealthConnectEntryPayload,
  buildManualHealthConnectSummary,
  normalizeSummary,
} from "../src/lib/health-connect.ts";

test("Health Connect omits metrics the provider did not supply", () => {
  const summary = normalizeSummary({ day: "2026-11-25", steps: 5400 });

  assert.deepEqual(summary, {
    day: "2026-11-25",
    steps: 5400,
    source: "health_connect",
  });
  assert.deepEqual(buildHealthConnectEntryPayload("user-1", summary!), {
    user_id: "user-1",
    day: "2026-11-25",
    steps: 5400,
    source: "health_connect",
  });
});

test("Health Connect keeps explicit zero and supplied metric values", () => {
  const summary = normalizeSummary({
    day: "2026-11-25",
    steps: 0,
    activeKcal: 315,
    sleepHours: 7.5,
    weightKg: 72.4,
    restingHr: 58,
    distanceM: 2400,
  });

  assert.deepEqual(summary, {
    day: "2026-11-25",
    steps: 0,
    activeKcal: 315,
    sleepMin: 450,
    weightKg: 72.4,
    restingHr: 58,
    distanceM: 2400,
    source: "health_connect",
  });
  assert.deepEqual(buildHealthConnectEntryPayload("user-1", summary!), {
    user_id: "user-1",
    day: "2026-11-25",
    steps: 0,
    active_kcal: 315,
    sleep_min: 450,
    weight_kg: 72.4,
    source: "health_connect",
  });
});

test("Health Connect treats null provider metrics as omitted", () => {
  const summary = normalizeSummary({
    day: "2026-11-25",
    steps: 2500,
    activeKcal: null,
    sleepMin: null,
    weightKg: null,
  });

  assert.deepEqual(summary, {
    day: "2026-11-25",
    steps: 2500,
    source: "health_connect",
  });
});


test("manual Health Connect input omits malformed, out-of-range and null metrics", () => {
  const summary = buildManualHealthConnectSummary({
    day: "2026-11-25",
    steps: Number.NaN,
    activeKcal: 20_001,
    sleepHours: 25,
    weightKg: null,
  });

  assert.deepEqual(summary, {
    day: "2026-11-25",
    source: "health_connect",
  });
  assert.deepEqual(buildHealthConnectEntryPayload("user-1", summary), {
    user_id: "user-1",
    day: "2026-11-25",
    source: "health_connect",
  });
});

test("manual Health Connect input preserves valid values including explicit zero", () => {
  const summary = buildManualHealthConnectSummary({
    day: "2026-11-25",
    steps: 0,
    activeKcal: 315,
    sleepHours: 7.5,
    weightKg: 72.4,
  });

  assert.deepEqual(summary, {
    day: "2026-11-25",
    steps: 0,
    activeKcal: 315,
    sleepMin: 450,
    weightKg: 72.4,
    source: "health_connect",
  });
});

test("health entry upsert omits explicit null weight instead of clearing it", () => {
  assert.deepEqual(
    buildHealthConnectEntryPayload("user-1", {
      day: "2026-11-25",
      weightKg: null,
      source: "health_connect",
    }),
    {
      user_id: "user-1",
      day: "2026-11-25",
      source: "health_connect",
    },
  );
});
