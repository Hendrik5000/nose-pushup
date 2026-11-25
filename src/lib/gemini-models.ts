export type GeminiModelMode = "auto" | "gemini-4-hydrogen" | "gemini-3.1-flash-lite";
export type GeminiModel = Exclude<GeminiModelMode, "auto">;

export const GEMINI_MODEL_LABELS: Record<GeminiModelMode, string> = {
  auto: "Automatisch nach Aufgabe (Hydrogen + Flash-Lite)",
  "gemini-4-hydrogen": "gemini-4-hydrogen (Allgemein & tiefes Denken)",
  "gemini-3.1-flash-lite": "gemini-3.1-flash-lite (Schnell)",
};

const FAST_GEMINI_TASKS = new Set(["quick_log", "motivation", "chat_summary"]);

export function isGeminiModelMode(model: string): model is GeminiModelMode {
  return model === "auto" || model === "gemini-4-hydrogen" || model === "gemini-3.1-flash-lite";
}

export function resolveGeminiModelForTask(
  task: string,
  configuredModel: string = "auto",
): GeminiModel {
  if (configuredModel === "gemini-3.1-flash-lite") return "gemini-3.1-flash-lite";
  if (configuredModel === "gemini-4-hydrogen") return "gemini-4-hydrogen";
  return FAST_GEMINI_TASKS.has(task) ? "gemini-3.1-flash-lite" : "gemini-4-hydrogen";
}
