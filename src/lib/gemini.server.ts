import { GoogleGenAI, ThinkingLevel, type Content, type Part } from "@google/genai";
import type { MiraAttachment, MiraProviderMessage } from "@/lib/mira-attachments";
import { normalizeProviderApiKey, safeGeminiError } from "@/lib/ai-provider-errors";
import { isGeminiModelMode, resolveGeminiModelForTask } from "@/lib/gemini-models";

export { isGeminiModelMode };

const MAX_OUTPUT_TOKENS = 1200;
const DEEP_REASONING_TASKS = new Set([
  "science",
  "coding",
  "stats_analysis",
  "training_plan",
  "form_technique",
]);

function buildBinaryParts(attachments: readonly MiraAttachment[]): Part[] {
  return attachments.flatMap((item) => {
    if (
      !item.dataUrl ||
      (!item.mime.startsWith("image/") && item.mime !== "application/pdf")
    ) {
      return [];
    }
    const commaIndex = item.dataUrl.indexOf(",");
    const data = commaIndex < 0 ? "" : item.dataUrl.slice(commaIndex + 1);
    return data ? [{ inlineData: { mimeType: item.mime, data } }] : [];
  });
}

export async function runGeminiChat({
  apiKey,
  messages,
  systemInstruction,
  task,
  requestedModel = "auto",
}: {
  apiKey: string;
  messages: readonly MiraProviderMessage[];
  systemInstruction: string;
  task: string;
  requestedModel?: string;
}): Promise<{ reply: string; model: string }> {
  if (messages.length === 0) throw new Error("Keine Nachricht");
  if (!isGeminiModelMode(requestedModel)) throw new Error("Gemini-Modell nicht freigegeben.");
  const normalizedApiKey = normalizeProviderApiKey(apiKey);
  if (!normalizedApiKey) {
    throw new Error("Gemini-API-Key fehlt. Bitte prüfe deine Mira-Einstellungen.");
  }

  const model = resolveGeminiModelForTask(task, requestedModel);
  const lastMessage = messages[messages.length - 1];
  const history: Content[] = messages.slice(0, -1).map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));
  const binaryParts = buildBinaryParts(lastMessage.attachments ?? []);
  const finalMessage: string | Part[] =
    binaryParts.length > 0 ? [...binaryParts, { text: lastMessage.content }] : lastMessage.content;
  const config = {
    systemInstruction,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    ...(model === "gemini-4-hydrogen"
      ? {
          thinkingConfig: {
            thinkingLevel: DEEP_REASONING_TASKS.has(task) ? ThinkingLevel.HIGH : ThinkingLevel.MEDIUM,
          },
        }
      : {}),
  };

  try {
    const ai = new GoogleGenAI({ apiKey: normalizedApiKey });
    const chat = ai.chats.create({ model, history, config });
    const response = await chat.sendMessage({ message: finalMessage });
    return { reply: (response.text ?? "").trim(), model };
  } catch (error) {
    throw safeGeminiError(error);
  }
}
