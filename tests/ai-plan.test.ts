import assert from "node:assert/strict";
import test from "node:test";
import { applyPlanFeedback, parseAiResponse, validateAiWorkoutPlan } from "../src/lib/ai-plan.ts";

const validPlan = {
  title: "Ruhige Push-up-Einheit",
  exercise_id: "pushup",
  sets: 3,
  reps: 10,
  rest_s: 60,
  rationale: "Moderates Volumen für saubere Wiederholungen.",
};

test("validates only complete, bounded structured plans", () => {
  assert.deepEqual(validateAiWorkoutPlan(validPlan), validPlan);
  assert.equal(validateAiWorkoutPlan({ ...validPlan, reps: 101 }), null);
  assert.equal(validateAiWorkoutPlan({ ...validPlan, rest_s: 0 }), null);
  assert.equal(validateAiWorkoutPlan({ ...validPlan, exercise_id: "invented" }), null);
  assert.equal(validateAiWorkoutPlan({ sets: 3, reps: 10, rest_s: 60 }), null);
});

test("parses a JSON plan and keeps a normal answer as text", () => {
  assert.deepEqual(parseAiResponse(JSON.stringify({ reply: "Vorschlag.", plan: validPlan })), {
    reply: "Vorschlag.",
    plan: validPlan,
  });
  const prose = "Mach 4 Sätze mit 12 Wiederholungen und 60 Sekunden Pause.";
  assert.deepEqual(parseAiResponse(prose), { reply: prose, plan: null });
});

test("rejects invalid structured plans rather than displaying them as actionable", () => {
  const raw = JSON.stringify({ reply: "Text", plan: { ...validPlan, sets: 999 } });
  assert.deepEqual(parseAiResponse(raw), { reply: raw, plan: null });
});

test("difficulty feedback changes the next validated plan", () => {
  assert.deepEqual(
    {
      sets: applyPlanFeedback(validPlan, "zu_schwer").sets,
      reps: applyPlanFeedback(validPlan, "zu_schwer").reps,
    },
    { sets: 2, reps: 8 },
  );
  assert.equal(applyPlanFeedback(validPlan, "zu_leicht").reps, 11);
  assert.equal(applyPlanFeedback(validPlan, "passt").reps, 10);
});
