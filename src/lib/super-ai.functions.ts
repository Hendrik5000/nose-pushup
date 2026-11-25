import { fetchAiProvider } from "@/lib/ai-provider-fetch";
import {
  assertMiraAttachmentProvider,
  validateMiraAttachments,
  includeMiraTextAttachments,
  miraInputCharacterCount,
  type MiraAttachment,
} from "@/lib/mira-attachments";
import { buildMiraSystemPrompt } from "@/lib/mira-response-policy";
import { runGeminiChat } from "@/lib/gemini.server";
import { isGeminiModelMode } from "@/lib/gemini-models";
import { normalizeProviderApiKey, safeOpenRouterErrorMessage } from "@/lib/ai-provider-errors";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type ProviderId =
  | "openai"
  | "anthropic"
  | "google"
  | "lovable"
  | "custom"
  | "openrouter"
  | "cerebras"
  | "cloudflare";

type ProviderPayload = {
  id: ProviderId;
  apiKey: string;
  model: string;
};

type InMsg = {
  role: "user" | "assistant";
  content: string;
  imageDataUrl?: string;
  attachments?: MiraAttachment[];
};

type SuperAiResult = {
  reply: string;
  provider: ProviderId;
  model: string;
  task: string;
};

const rateBuckets = new Map<string, number[]>();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_PER_WINDOW = 20;
const MAX_INPUT_CHARS = 12_000;
const MAX_API_KEY_CHARS = 500;
const OPENROUTER_MODEL = "openrouter/free";

function assertOpenRouterModelAllowed(model: string) {
  if (model !== OPENROUTER_MODEL) throw new Error("Modell nicht erlaubt.");
}

function checkUserRateLimit(userId: string) {
  const now = Date.now();
  const prev = rateBuckets.get(userId) ?? [];
  const recent = prev.filter((time) => now - time < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX_PER_WINDOW) {
    throw new Error("Rate limit — bitte kurz warten (max. 20 Anfragen / Minute).");
  }
  recent.push(now);
  rateBuckets.set(userId, recent);
  if (rateBuckets.size > 5000) {
    for (const [key, values] of rateBuckets) {
      if (!values.some((time) => now - time < RATE_WINDOW_MS)) rateBuckets.delete(key);
    }
  }
}

async function callOpenAICompat(
  apiKey: string,
  model: string,
  system: string,
  messages: InMsg[],
): Promise<string> {
  const response = await fetchAiProvider("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 1200,
      messages: [
        { role: "system", content: system },
        ...messages.map((message) => ({ role: message.role, content: message.content })),
      ],
    }),
  });
  if (!response.ok) {
    throw new Error(safeOpenRouterErrorMessage(response.status));
  }
  const json = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  return (json.choices?.[0]?.message?.content ?? "").trim();
}

export const superAiChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const raw = (input ?? {}) as {
      messages?: InMsg[];
      attachments?: unknown;
      provider?: ProviderPayload;
      task?: string;
      systemExtra?: string;
    };
    const messages = Array.isArray(raw.messages) ? raw.messages : [];
    const cleaned = messages
      .filter((message) =>
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string",
      )
      .slice(-16)
      .map((message, index, all) => {
        const base: InMsg = { role: message.role, content: message.content.slice(0, 6000) };
        if (index === all.length - 1 && message.imageDataUrl !== undefined) {
          if (message.role !== "user" || typeof message.imageDataUrl !== "string")
            throw new Error("Ungültiger Bildanhang.");
          const match = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/.exec(
            message.imageDataUrl,
          );
          if (!match) throw new Error("Ungültiger Bildanhang.");
          const extension = match[1].split("/")[1];
          base.attachments = validateMiraAttachments([
            {
              name: `Foto.${extension}`,
              mime: match[1],
              size:
                Math.floor((match[2].length * 3) / 4) -
                (match[2].endsWith("==") ? 2 : match[2].endsWith("=") ? 1 : 0),
              dataUrl: message.imageDataUrl,
            },
          ]);
        }
        return base;
      });
    if (cleaned.length === 0) throw new Error("Keine Nachricht");
    const attachments = validateMiraAttachments(raw.attachments);
    const last = cleaned[cleaned.length - 1];
    if (attachments.length) {
      if (last.role !== "user" || last.attachments?.length)
        throw new Error("Anhänge nur an der letzten Nutzernachricht erlaubt.");
      last.attachments = attachments;
    }
    const totalChars = miraInputCharacterCount(cleaned, attachments);
    if (totalChars > MAX_INPUT_CHARS) {
      throw new Error(`Eingabe zu lang (max. ${MAX_INPUT_CHARS} Zeichen insgesamt)`);
    }
    if (!raw.provider?.id) throw new Error("Kein Provider gewählt");
    const apiKey = normalizeProviderApiKey(raw.provider.apiKey);
    if (apiKey.length > MAX_API_KEY_CHARS) throw new Error("API-Key ungültig oder zu lang.");
    const provider: ProviderPayload = {
      id: raw.provider.id,
      apiKey,
      model: String(raw.provider.model ?? "").slice(0, 80),
    };
    return {
      messages: cleaned,
      provider,
      task: String(raw.task ?? "general").slice(0, 40),
      systemExtra: String(raw.systemExtra ?? "").slice(0, 12000),
    };
  })
  .handler(async ({ data, context }): Promise<SuperAiResult> => {
    const { userId } = context as { userId: string };
    const provider = data.provider;
    if (provider.id !== "openrouter" && provider.id !== "google") {
      throw new Error("Dieser KI-Anbieter ist in Alo nicht freigeschaltet.");
    }
    checkUserRateLimit(userId);

    const attachments = data.messages.flatMap((message) => message.attachments ?? []);
    assertMiraAttachmentProvider(provider.id, attachments);
    const providerMessages = includeMiraTextAttachments(data.messages);
    const system = buildMiraSystemPrompt(data.systemExtra ?? "");

    if (!provider.apiKey) {
      throw new Error(
        provider.id === "google"
          ? "Gemini-API-Key fehlt. Öffne die Mira-Einstellungen und trage deinen eigenen Key ein."
          : "OpenRouter API-Key fehlt",
      );
    }

    if (provider.id === "google") {
      if (!isGeminiModelMode(provider.model)) throw new Error("Gemini-Modell nicht freigegeben.");
      const response = await runGeminiChat({
        apiKey: provider.apiKey,
        messages: providerMessages,
        systemInstruction: system,
        task: data.task,
        requestedModel: provider.model,
      });
      return {
        reply: response.reply || "Keine Antwort erhalten.",
        provider: provider.id,
        model: response.model,
        task: data.task,
      };
    }

    assertOpenRouterModelAllowed(provider.model);
    if (attachments.some((item) => item.mime.startsWith("image/"))) {
      throw new Error(
        "OpenRouter ist in Alo nur für Text und Textdateien freigeschaltet. Es wurde kein Bild gesendet.",
      );
    }
    const reply = await callOpenAICompat(
      provider.apiKey,
      provider.model,
      system,
      providerMessages,
    );
    return {
      reply: reply || "Keine Antwort erhalten.",
      provider: provider.id,
      model: provider.model,
      task: data.task,
    };
  });
