/** Strict validation helpers for actionable plans returned by Super-AI. */

import { validateMiraInteraction, type MiraInteraction } from "./mira-interactions";

export type AiWorkoutPlan = {
  title: string;
  exercise_id: "pushup" | "situp" | "squat" | "plank" | "burpee";
  sets: number;
  reps: number;
  rest_s: number;
  rationale: string;
};

export type PlanFeedback = "zu_schwer" | "zu_leicht" | "passt_nicht" | "passt";

/** Pick the newest rating saved on an individual recommendation in this session. */
export function getMostRecentPlanFeedback(
  messages: ReadonlyArray<{
    role: "user" | "assistant";
    plan?: AiWorkoutPlan;
    feedback?: PlanFeedback;
  }>,
): PlanFeedback | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message?.role === "assistant" && message.plan && message.feedback) {
      return message.feedback;
    }
  }
  return null;
}

const EXERCISES = new Set<AiWorkoutPlan["exercise_id"]>([
  "pushup",
  "situp",
  "squat",
  "plank",
  "burpee",
]);

/** Prose is never mined for numbers; an optional interaction is accepted only by allowlist. */
export function parseAiResponse(raw: string): {
  reply: string;
  plan: AiWorkoutPlan | null;
  interaction?: MiraInteraction;
} {
  const text = raw.trim();
  const jsonText = unwrapJsonFence(text);
  if (!jsonText) return { reply: text, plan: null };

  let value: unknown;
  try {
    value = JSON.parse(jsonText);
  } catch {
    return { reply: text, plan: null };
  }

  if (!isRecord(value)) return { reply: text, plan: null };
  const hasInteraction = Object.prototype.hasOwnProperty.call(value, "interaction");
  const interaction = validateMiraInteraction(value.interaction);
  const plan = validateAiWorkoutPlan(value.plan);
  const reply = typeof value.reply === "string" ? value.reply.trim() : "";
  if (plan) return { reply, plan, ...(interaction ? { interaction } : {}) };
  if (hasInteraction && typeof value.reply === "string" && reply) {
    return { reply, plan: null, ...(interaction ? { interaction } : {}) };
  }
  return { reply: text, plan: null };
}

export function validateAiWorkoutPlan(value: unknown): AiWorkoutPlan | null {
  if (!isRecord(value)) return null;
  const { title, exercise_id, sets, reps, rest_s, rationale } = value;
  if (
    typeof title !== "string" ||
    title.trim().length < 2 ||
    title.length > 80 ||
    typeof exercise_id !== "string" ||
    !EXERCISES.has(exercise_id as AiWorkoutPlan["exercise_id"]) ||
    !isIntegerInRange(sets, 1, 10) ||
    !isIntegerInRange(reps, 1, 100) ||
    !isIntegerInRange(rest_s, 15, 300) ||
    typeof rationale !== "string" ||
    rationale.trim().length < 8 ||
    rationale.length > 300
  )
    return null;

  return {
    title: title.trim(),
    exercise_id: exercise_id as AiWorkoutPlan["exercise_id"],
    sets,
    reps,
    rest_s,
    rationale: rationale.trim(),
  };
}

/** Apply the user's last difficulty rating to a returned plan before it can be used. */
export function applyPlanFeedback(
  plan: AiWorkoutPlan,
  feedback: PlanFeedback | null,
): AiWorkoutPlan {
  // A mismatch is not a difficulty rating: ask what should change instead of
  // silently increasing or decreasing the same exercise.
  if (!feedback || feedback === "passt" || feedback === "passt_nicht") return plan;
  if (feedback === "zu_schwer") {
    return {
      ...plan,
      sets: Math.max(1, plan.sets - 1),
      reps: Math.max(1, Math.floor(plan.reps * 0.8)),
      rationale: `${plan.rationale} Umfang um eine Stufe reduziert, weil du den letzten Vorschlag als zu schwer bewertet hast.`,
    };
  }
  return {
    ...plan,
    reps: Math.min(100, Math.max(plan.reps + 1, Math.ceil(plan.reps * 1.1))),
    rationale: `${plan.rationale} Wiederholungen leicht erhöht, weil du den letzten Vorschlag als zu leicht bewertet hast.`,
  };
}

function unwrapJsonFence(text: string): string | null {
  if (text.startsWith("{") && text.endsWith("}")) return text;
  if (!text.startsWith("```json") || !text.endsWith("```")) return null;
  return text.slice("```json".length, -3).trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}
