import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseHealthJson, parseStepsCsv } from "../src/lib/smartwatch.ts";
import {
  formatWatchImportResult,
  importWatchRows,
  syncWatchDay,
  type WatchHealthEntryPayload,
  type WatchSyncGateway,
} from "../src/lib/smartwatch-sync.ts";

function createGateway(
  overrides: Partial<WatchSyncGateway> = {},
  onUpsert: (payload: WatchHealthEntryPayload) => void = () => {},
): WatchSyncGateway {
  return {
    getUserId: async () => "user-1",
    getEntry: async () => ({
      steps: 1000,
      active_kcal: 120,
      sleep_min: 420,
      weight_kg: 72.5,
    }),
    upsert: async (payload) => onUpsert(payload),
    ...overrides,
  };
}

test("Watch fallback dates follow the local calendar rather than UTC", () => {
  const previousTimezone = process.env.TZ;
  process.env.TZ = "America/Los_Angeles";
  try {
    const nearUtcMidnight = new Date("2026-11-01T00:30:00.000Z");
    assert.equal(parseStepsCsv("1200", nearUtcMidnight)[0]?.day, "2026-10-31");
    assert.equal(parseHealthJson('{"steps":1200}', nearUtcMidnight)?.day, "2026-10-31");
    assert.equal(
      parseHealthJson('{"steps":1200,"date":"2026-11-01T00:30:00Z"}', nearUtcMidnight)?.day,
      "2026-11-01",
    );
  } finally {
    if (previousTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimezone;
  }
});

test("watch sync preserves measurements not present in a partial import", async () => {
  let saved: WatchHealthEntryPayload | undefined;
  await syncWatchDay(
    "2026-10-31",
    { steps: 8500 },
    createGateway({}, (payload) => (saved = payload)),
  );

  assert.deepEqual(saved, {
    user_id: "user-1",
    day: "2026-10-31",
    steps: 8500,
    active_kcal: 120,
    sleep_min: 420,
    weight_kg: 72.5,
    source: "watch",
  });
});

test("watch sync stops on auth, merge-read, or write errors", async () => {
  let writes = 0;
  await assert.rejects(
    syncWatchDay(
      "2026-10-31",
      { steps: 10 },
      createGateway(
        {
          getUserId: async () => {
            throw new Error("auth unavailable");
          },
        },
        () => writes++,
      ),
    ),
    /auth unavailable/,
  );
  await assert.rejects(
    syncWatchDay(
      "2026-10-31",
      { steps: 10 },
      createGateway(
        {
          getEntry: async () => {
            throw new Error("read unavailable");
          },
        },
        () => writes++,
      ),
    ),
    /read unavailable/,
  );
  await assert.rejects(
    syncWatchDay(
      "2026-10-31",
      { steps: 10 },
      createGateway(
        {
          upsert: async () => {
            throw new Error("write unavailable");
          },
        },
        () => writes++,
      ),
    ),
    /write unavailable/,
  );
  await assert.rejects(
    syncWatchDay("2026-10-31", { steps: 10 }, createGateway({ getUserId: async () => null })),
    /authenticated user/,
  );
  assert.equal(writes, 0);
});

test("CSV rows are counted independently and failed dates are shown for retry", async () => {
  const rows = parseStepsCsv("2026-10-29,1000\n2026-10-30,2000\n2026-10-31,3000");
  const result = await importWatchRows(rows, async (row) => {
    if (row.day === "2026-10-30") throw new Error("temporary write failure");
  });

  assert.deepEqual(
    result.imported.map((row) => row.day),
    ["2026-10-29", "2026-10-31"],
  );
  assert.deepEqual(
    result.failed.map((row) => row.day),
    ["2026-10-30"],
  );
  assert.equal(
    formatWatchImportResult(result),
    "2 Tage importiert; 1 Tag konnte nicht gespeichert werden (30.10.2026). Bitte Datei erneut importieren.",
  );
});

test("watch UI only marks confirmed syncs, reports failures, and announces status", () => {
  const panel = readFileSync(
    new URL("../src/components/SmartwatchPanel.tsx", import.meta.url),
    "utf8",
  );
  assert.match(panel, /getUserId: async \(\) =>[\s\S]*?if \(error\) throw error/);
  assert.match(panel, /await syncToCloud\(day,[\s\S]*?\);\s*markWatchSynced/);
  assert.match(panel, /finally \{[\s\S]*?setBusy\(false\)/);
  assert.match(panel, /importWatchRows\(rows\.slice\(0, 31\)/);
  assert.match(panel, /formatWatchImportResult\(result\)/);
  assert.match(panel, /role="status"[\s\S]*?aria-live="polite"[\s\S]*?aria-atomic="true"/);
  assert.doesNotMatch(panel, /toISOString\(\)\.slice\(0, 10\)/);
});
