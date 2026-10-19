import assert from "node:assert/strict";
import test from "node:test";
import {
  getDashboardRecommendation,
  getQuickStartPlan,
  getWeeklyProgress,
} from "../src/lib/workout-plans.ts";

test("dashboard recommendation detail agrees with the structured plan and projected reps", () => {
  const plan = getQuickStartPlan({ best: 30, todayReps: 20, streak: 12, goal: 50 });
  assert.equal(plan.sets, 2);
  assert.equal(plan.reps, 10);
  assert.equal(plan.plannedReps, 20);
  assert.match(plan.detail, /2 Sätze × 10 Reps \(20 geplant\)/);
  assert.match(plan.detail, /40 von 50 Tages-Reps/);

  const recommendation = getDashboardRecommendation({ plan, readinessAvailable: false });
  assert.equal(recommendation.sets, plan.sets);
  assert.equal(recommendation.reps, plan.reps);
  assert.match(recommendation.readinessNote, /Readiness noch nicht verfügbar/);
});

test("completed day is described as an optional additional block", () => {
  const plan = getQuickStartPlan({ best: 40, todayReps: 50, streak: 8, goal: 50 });
  assert.equal(plan.remaining, 0);
  assert.equal(plan.plannedReps, plan.sets * plan.reps);
  assert.match(plan.headline, /Tagesziel erreicht/);
  assert.match(plan.detail, /optional/);
});

test("weekly progress reports absolute reps and the explicit goal", () => {
  assert.deepEqual(getWeeklyProgress({ weekReps: 128, target: 350 }), {
    weekReps: 128,
    target: 350,
    percent: 37,
    state: "behind",
    message: "Noch 222 Reps bis zum Wochenziel.",
  });
});

test("a guest without history receives an explicitly general short starter plan", () => {
  const plan = getQuickStartPlan({ best: 0, todayReps: 0, streak: 0, goal: 50 });
  assert.equal(plan.sets, 2);
  assert.equal(plan.reps, 5);
  assert.match(plan.detail, /Allgemeiner Einstiegsplan/);
});

test("low readiness changes the actual transferred plan, not only its label", () => {
  const plan = getQuickStartPlan({ best: 30, todayReps: 0, streak: 3, goal: 50 });
  const recovery = getDashboardRecommendation({
    plan,
    readinessAvailable: true,
    readinessLabel: "Regenerieren",
    readinessLevel: "red",
  });
  assert.equal(recovery.recoveryDay, true);
  assert.match(recovery.headline, /regenerieren/);
  assert.equal(recovery.sets * recovery.reps, recovery.plannedReps);
  assert.ok(recovery.plannedReps < plan.plannedReps);
  assert.match(recovery.detail, /1 Satz × 3/);
});

test("a large remaining daily target does not multiply a beginner's workload", () => {
  const plan = getQuickStartPlan({ best: 10, todayReps: 10, streak: 1, goal: 50 });
  assert.ok(plan.reps <= 5);
  assert.ok(plan.plannedReps <= 15);
});
