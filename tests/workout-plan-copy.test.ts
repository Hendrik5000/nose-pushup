import assert from "node:assert/strict";
import test from "node:test";
import {
  getQuickStartPlan,
  getWeeklyProgress,
  getSmartReminder,
} from "../src/lib/workout-plans.ts";

test("workout recommendations, weekly progress and reminders use clear German copy", () => {
  const plan = getQuickStartPlan({ best: 30, todayReps: 20, streak: 3, goal: 50 });
  assert.match(plan.headline, /Wiederholungen/);
  assert.match(plan.detail, /Wiederholungen/);
  assert.doesNotMatch(`${plan.headline} ${plan.detail}`, /\bReps\b/);

  assert.match(getWeeklyProgress({ weekReps: 128, target: 350 }).message, /Wiederholungen/);
  assert.match(getSmartReminder({ todayReps: 10, goal: 50, streak: 1 }).text, /Wiederholungen/);
  assert.match(getSmartReminder({ todayReps: 0, goal: 50, streak: 0 }).text, /Wiederholungen/);
});
