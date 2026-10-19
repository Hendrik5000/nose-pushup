import assert from "node:assert/strict";
import test from "node:test";
import { averageMeasuredHealthValue, measuredHealthValue } from "../src/lib/health-glance.ts";

test("zero, absent, and invalid defaults are not presented as measured values", () => {
  assert.equal(measuredHealthValue(0), null);
  assert.equal(measuredHealthValue(null), null);
  assert.equal(measuredHealthValue(undefined), null);
  assert.equal(measuredHealthValue(Number.NaN), null);
  assert.equal(measuredHealthValue(-1), null);
  assert.equal(measuredHealthValue(7342), 7342);
});

test("averages only days with a positive measurement and reports the sample count", () => {
  assert.deepEqual(averageMeasuredHealthValue([0, 6000, null, 8000, Number.NaN]), {
    average: 7000,
    count: 2,
  });
  assert.deepEqual(averageMeasuredHealthValue([0, null, undefined]), {
    average: null,
    count: 0,
  });
});

test("health overview keeps real daily values and both source and entry actions discoverable", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(
    new URL("../src/routes/_authenticated/health.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /aria-label="Erfasste Tageswerte"/);
  assert.match(source, /href="#health-sources" className="health-source-action"/);
  assert.match(source, /entry.day >= weekStart.toISOString\(\).slice\(0, 10\)/);
  assert.doesNotMatch(source, /const week = entries.slice/);
});
