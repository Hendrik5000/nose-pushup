import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { DEFAULT_PROVIDERS, type ProviderConfig } from "../src/lib/ai-providers";
import {
  aiStatusFromProviders,
  formatDailyGoalLine,
  formatHealthTodayParts,
  formatPostfachContextLine,
  formatStreakLine,
  hasMeasuredHealthToday,
  parseHealthTodayRow,
  formatWeeklyWorkoutLine,
  NEXUS_UNREAD_SUMMARY_THRESHOLD,
  shouldOfferChatSummary,
  sumKnownUnread,
} from "../src/lib/home-day-widgets";
import { SUPER_TOOLS } from "../src/lib/super-ai-tools";

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
  const openrouter = DEFAULT_PROVIDERS.find((provider) => provider.id === "openrouter");
  assert.ok(openrouter);
  const enabled: ProviderConfig = {
    ...openrouter,
    enabled: true,
    apiKey: "test-key",
    model: "openrouter/free",
  };
  const status = aiStatusFromProviders([enabled]);
  assert.ok(status);
  assert.equal(status.provider, enabled.label);
  assert.equal(status.model, "openrouter/free");

  const withoutOpenRouter = DEFAULT_PROVIDERS.filter((provider) => provider.id !== "openrouter");
  assert.equal(aiStatusFromProviders(withoutOpenRouter), null);
});

test("weekly workout lines and the chat summary threshold stay honest", () => {
  assert.equal(formatWeeklyWorkoutLine(0), "Noch kein Workout diese Woche");
  assert.equal(formatWeeklyWorkoutLine(1), "Diese Woche: 1 Workout");
  assert.equal(formatWeeklyWorkoutLine(4), "Diese Woche: 4 Workouts");
  assert.equal(formatWeeklyWorkoutLine(Number.NaN), null);
  assert.equal(formatWeeklyWorkoutLine(-1), null);

  assert.equal(shouldOfferChatSummary(null), false);
  assert.equal(shouldOfferChatSummary(0), false);
  assert.equal(shouldOfferChatSummary(NEXUS_UNREAD_SUMMARY_THRESHOLD - 1), false);
  assert.equal(shouldOfferChatSummary(NEXUS_UNREAD_SUMMARY_THRESHOLD), true);
  assert.equal(shouldOfferChatSummary(25), true);

  const summaryTool = SUPER_TOOLS.find((tool) => tool.id === "chat_summary");
  assert.ok(summaryTool);
  assert.match(summaryTool.prompt, /Chat-Nachrichten/);
});

test("the home screen no longer renders the removed daily overview", () => {
  const home = readFileSync("src/routes/_authenticated/index.tsx", "utf8");
  assert.doesNotMatch(home, /<AloErrorBoundary section="Dein Tag">|Health heute:/);
});

test("daily goal line only shows with a set goal and known reps", () => {
  assert.equal(formatDailyGoalLine(null, 50), null);
  assert.equal(formatDailyGoalLine(30, 0), null);
  assert.equal(formatDailyGoalLine(30, -5), null);
  assert.equal(formatDailyGoalLine(30, 50), "Heute 30 / 50 Wiederholungen");
  assert.equal(formatDailyGoalLine(50, 50), "Tagesziel erreicht: 50 / 50");
  assert.equal(formatDailyGoalLine(62, 50), "Tagesziel erreicht: 62 / 50");
});

test("postfach context line shows real unread and actionable counts only", () => {
  assert.equal(formatPostfachContextLine(3, 1, false), null);
  assert.equal(formatPostfachContextLine(0, 0, true), null);
  assert.equal(formatPostfachContextLine(2, 0, true), "2 ungelesene Nachrichten");
  assert.equal(formatPostfachContextLine(1, 0, true), "1 ungelesene Nachricht");
  assert.equal(formatPostfachContextLine(0, 2, true), "2 offene Anfragen");
  assert.equal(
    formatPostfachContextLine(3, 1, true),
    "3 ungelesene Nachrichten · 1 offene Anfrage",
  );
});
