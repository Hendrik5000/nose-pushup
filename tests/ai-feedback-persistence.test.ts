import assert from "node:assert/strict";
import test from "node:test";
import { applyPlanFeedback, getMostRecentPlanFeedback } from "../src/lib/ai-plan.ts";
import { loadSessions, saveSessions, type AiSession } from "../src/lib/super-ai-tools.ts";

const plan = {
  title: "Kurzer Einstieg",
  exercise_id: "pushup" as const,
  sets: 2,
  reps: 5,
  rest_s: 45,
  rationale: "Ein allgemeiner kurzer Einstiegsplan.",
};

test("a mismatched exercise is not silently treated as too easy", () => {
  assert.deepEqual(applyPlanFeedback(plan, "passt_nicht"), plan);
  assert.equal(
    getMostRecentPlanFeedback([{ role: "assistant", plan, feedback: "passt_nicht" }]),
    "passt_nicht",
  );
});

test("ratings remain attached to each recommendation after a saved chat is reloaded", () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    },
  });
  try {
    const sessions: AiSession[] = [
      {
        id: "feedback-test",
        title: "Meine Rückmeldungen",
        updatedAt: "2026-10-19T12:00:00.000Z",
        messages: [
          { role: "assistant", content: "Erster Vorschlag", plan, feedback: "zu_schwer" },
          { role: "user", content: "Eine andere Übung bitte" },
          { role: "assistant", content: "Zweiter Vorschlag", plan, feedback: "passt_nicht" },
        ],
      },
    ];
    saveSessions(sessions);
    const restored = loadSessions();
    assert.deepEqual(restored, sessions);
    assert.equal(restored[0].messages[0].feedback, "zu_schwer");
    assert.equal(getMostRecentPlanFeedback(restored[0].messages), "passt_nicht");
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
