import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { DEFAULT_PROVIDERS, type ProviderConfig } from "../src/lib/ai-providers";
import {
  aiStatusFromProviders,
  formatHealthTodayParts,
  formatStreakLine,
  hasMeasuredHealthToday,
  parseHealthTodayRow,
  sumKnownUnread,
} from "../src/lib/home-day-widgets";

test("health today rows parse and only measured values count", () => {
  const entry = parseHealthTodayRow({ steps: 3500, active_kcal: 320, sleep_min: 450 });
  assert.deepEqual(entry, { steps: 3500, activeKcal: 320, sleepMin: 450 });
  assert.ok(hasMeasuredHealthToday(entry));

  assert.deepEqual(parseHealthTodayRow(null), { steps: null, activeKcal: null, sleepMin: null });
  assert.deepEqual(parseHealthTodayRow("x"), { steps: null, activeKcal: null, sleepMin: null });
  assert.deepEqual(parseHealthTodayRow({ steps: "3500" }), {
    steps: null,
    activeKcal: null,
    sleepMin: null,
  });
  assert.equal(hasMeasuredHealthToday(parseHealthTodayRow({ steps: 0, sleep_min: 0 })), false);
  assert.equal(hasMeasuredHealthToday(null), false);
});

test("health today parts format in german", () => {
  assert.deepEqual(formatHealthTodayParts({ steps: 3500, activeKcal: 320, sleepMin: 450 }), [
    "3.500 Schritte",
    "320 kcal aktiv",
    "7 h 30 min Schlaf",
  ]);
  assert.deepEqual(formatHealthTodayParts({ steps: 480, activeKcal: null, sleepMin: 480 }), [
    "480 Schritte",
    "8 h Schlaf",
  ]);
  assert.deepEqual(formatHealthTodayParts({ steps: null, activeKcal: null, sleepMin: null }), []);
});

test("streak line only appears for positive streaks", () => {
  assert.equal(formatStreakLine(5), "5-Tage-Streak");
  assert.equal(formatStreakLine(0), null);
  assert.equal(formatStreakLine(-2), null);
  assert.equal(formatStreakLine(Number.NaN), null);
  assert.equal(formatStreakLine(12.7), "12-Tage-Streak");
});

test("unread sums only known counts and stays honest about unknowns", () => {
  assert.equal(sumKnownUnread({ a: { unread: 2 }, b: { unread: 3 } }), 5);
  assert.equal(sumKnownUnread({ a: { unread: 2 }, b: { unread: null } }), 2);
  assert.equal(sumKnownUnread({ a: { unread: null }, b: { unread: null } }), null);
  assert.equal(sumKnownUnread({}), null);
  assert.equal(sumKnownUnread({ a: undefined, b: { unread: null } }), null);
  assert.equal(sumKnownUnread({ a: { unread: -4 } }), 0);
});

test("ai status reflects the real provider selection", () => {
  const openai = DEFAULT_PROVIDERS.find((provider) => provider.id === "openai");
  assert.ok(openai);
  const enabled: ProviderConfig = {
    ...openai,
    enabled: true,
    apiKey: "test-key",
    model: "gpt-test",
  };
  const status = aiStatusFromProviders([enabled]);
  assert.ok(status);
  assert.equal(status.provider, enabled.label);
  assert.equal(status.model, "gpt-test");

  const withoutLovable = DEFAULT_PROVIDERS.filter((provider) => provider.id !== "lovable");
  assert.equal(aiStatusFromProviders(withoutLovable), null);
});

test("the home screen wires real data into Dein Tag and the nexus badge", () => {
  const home = readFileSync("src/routes/_authenticated/index.tsx", "utf8");
  assert.match(home, /useHomeDayData\(user\.id\)/);
  assert.match(home, /useNexusUnread\(user\.id\)/);
  assert.match(home, /aiStatusFromProviders\(loadProviders\(user\.id\)\)/);
  assert.match(home, /tile\.id === "nexus" && nexusUnread/);
  assert.match(home, / ungelesen`/);
  assert.match(home, /Kein KI-Anbieter aktiv/);
  assert.match(home, /Health heute:/);
  assert.match(home, /formatStreakLine\(streak\)/);

  const dayData = readFileSync("src/hooks/useHomeDayData.ts", "utf8");
  assert.match(dayData, /from\("health_entries"\)/);
  assert.match(dayData, /\.select\("day, steps, active_kcal, sleep_min"\)/);
  assert.match(dayData, /from\("profiles"\)/);
  assert.match(dayData, /current_streak/);
  assert.match(dayData, /localDateKey/);

  const nexus = readFileSync("src/hooks/useNexusUnread.ts", "utf8");
  assert.match(nexus, /loadRoomPreview/);
  assert.match(nexus, /sumKnownUnread/);
  assert.match(nexus, /aggregateUnread/);
  assert.match(nexus, /loadChatPrefs/);
});
