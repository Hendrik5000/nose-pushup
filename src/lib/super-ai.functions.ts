import { fetchAiProvider } from "@/lib/ai-provider-fetch";
import {
  assertMiraAttachmentProvider,
  validateMiraAttachments,
  includeMiraTextAttachments,
  miraInputCharacterCount,
  type MiraAttachment,
} from "@/lib/mira-attachments";
import { buildMiraSystemPrompt } from "@/lib/mira-response-policy";
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

const OPENROUTER_MODEL = "openrouter/free";

function assertModelAllowed(model: string) {
  if (model !== OPENROUTER_MODEL) {
    throw new Error(`Modell nicht erlaubt: ${model}`);
  }
}

function checkUserRateLimit(userId: string) {
  const now = Date.now();
  const prev = rateBuckets.get(userId) ?? [];
  const recent = prev.filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX_PER_WINDOW) {
    throw new Error("Rate limit — bitte kurz warten (max. 20 Anfragen / Minute).");
  }
  recent.push(now);
  rateBuckets.set(userId, recent);
  if (rateBuckets.size > 5000) {
    for (const [k, v] of rateBuckets) {
      if (!v.some((t) => now - t < RATE_WINDOW_MS)) rateBuckets.delete(k);
    }
  }
}

async function callOpenAICompat(
  apiKey: string,
  model: string,
  system: string,
  messages: InMsg[],
): Promise<string> {
  const res = await fetchAiProvider("https://openrouter.ai/api/v1/chat/completions", {
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
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Provider ${res.status}: ${t.slice(0, 200)}`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
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
      .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-16)
      .map((m, idx, arr) => {
        const base: InMsg = { role: m.role, content: m.content.slice(0, 6000) };
        if (idx === arr.length - 1 && m.imageDataUrl !== undefined) {
          if (m.role !== "user" || typeof m.imageDataUrl !== "string")
            throw new Error("Ungültiger Bildanhang.");
          const match = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/.exec(m.imageDataUrl);
          if (!match) throw new Error("Ungültiger Bildanhang.");
          const ext = match[1].split("/")[1];
          base.attachments = validateMiraAttachments([
            {
              name: `Foto.${ext}`,
              mime: match[1],
              size:
                Math.floor((match[2].length * 3) / 4) -
                (match[2].endsWith("==") ? 2 : match[2].endsWith("=") ? 1 : 0),
              dataUrl: m.imageDataUrl,
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
    const provider: ProviderPayload = {
      id: raw.provider.id,
      apiKey: String(raw.provider.apiKey ?? "").slice(0, 500),
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
    const p = data.provider;
    if (p.id !== "openrouter") {
      throw new Error(
        "Alo ist im Free-only-Modus. Aktuell ist ausschließlich OpenRouter Free freigeschaltet; andere Anbieter sind gesperrt, um kostenpflichtige Nutzung auszuschließen.",
      );
    }
    checkUserRateLimit(userId);
    assertModelAllowed(p.model);

    const attachments = data.messages.flatMap((m) => m.attachments ?? []);
    if (attachments.some((item) => item.mime.startsWith("image/"))) {
      throw new Error(
        "Dieser Anbieter ist in Alo derzeit nur für Text und Textdateien freigeschaltet. Es wurde kein Bild gesendet.",
      );
    }
    assertMiraAttachmentProvider(p.id, attachments);

    const providerMessages = includeMiraTextAttachments(data.messages);
    const system = buildMiraSystemPrompt(data.systemExtra ?? "");

    if (!p.apiKey) throw new Error("OpenRouter API-Key fehlt");
    const reply = await callOpenAICompat(p.apiKey, p.model, system, providerMessages);

    return {
      reply: reply || "Keine Antwort erhalten.",
      provider: p.id,
      model: p.model,
      task: data.task,
    };
  });
