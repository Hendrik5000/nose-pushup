import assert from "node:assert/strict";
import test from "node:test";
import { getMostRecentPlanFeedback, type AiWorkoutPlan } from "../src/lib/ai-plan.ts";

const plan: AiWorkoutPlan = {
  title: "Ruhige Push-up-Einheit",
  exercise_id: "pushup",
  sets: 3,
  reps: 10,
  rest_s: 60,
  rationale: "Moderates Volumen für saubere Wiederholungen.",
};

test("reads feedback persisted on the newest rated workout recommendation", () => {
  const messages = [
    { role: "assistant" as const, content: "Vorschlag eins", plan, feedback: "zu_schwer" as const },
    { role: "assistant" as const, content: "Nur ein Chattext" },
    { role: "assistant" as const, content: "Vorschlag zwei", plan, feedback: "passt" as const },
  ];
  assert.equal(getMostRecentPlanFeedback(messages), "passt");
});

test("ignores unrated plans and non-plan assistant replies", () => {
  assert.equal(
    getMostRecentPlanFeedback([
      { role: "assistant", content: "Bewerteter Plan", plan, feedback: "zu_leicht" },
      { role: "assistant", content: "Noch neuerer, unbewerteter Plan", plan },
      { role: "assistant", content: "Text ohne Plan", feedback: "zu_schwer" },
    ]),
    "zu_leicht",
  );
  assert.equal(
    getMostRecentPlanFeedback([{ role: "assistant", content: "Normale Antwort" }]),
    null,
  );
});
