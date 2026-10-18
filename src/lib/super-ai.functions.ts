import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type ProviderId = "openai" | "anthropic" | "google" | "lovable" | "custom";

type ProviderPayload = {
  id: ProviderId;
  apiKey: string;
  baseUrl?: string;
  model: string;
};

type InMsg = { role: "user" | "assistant"; content: string };

type SuperAiResult = {
  reply: string;
  provider: ProviderId;
  model: string;
  task: string;
};

async function callOpenAICompat(
  baseUrl: string,
  apiKey: string,
  model: string,
  system: string,
  messages: InMsg[],
) {
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`OpenAI-kompatibel ${res.status}: ${t.slice(0, 180)}`);
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return (json.choices?.[0]?.message?.content ?? "").trim();
}

async function callAnthropic(
  apiKey: string,
  model: string,
  system: string,
  messages: InMsg[],
) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Anthropic ${res.status}: ${t.slice(0, 180)}`);
  }
  const json = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  return (json.content ?? [])
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("\n")
    .trim();
}

async function callGoogle(
  apiKey: string,
  model: string,
  system: string,
  messages: InMsg[],
) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Google ${res.status}: ${t.slice(0, 180)}`);
  }
  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return (json.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("")
    .trim();
}

async function callLovable(model: string, system: string, messages: InMsg[]) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Lovable Gateway nicht konfiguriert (LOVABLE_API_KEY).");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "Lovable-API-Key": key,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("Rate limit — bitte kurz warten.");
    if (res.status === 402) throw new Error("AI-Kredit aufgebraucht.");
    throw new Error(`Lovable ${res.status}: ${t.slice(0, 180)}`);
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return (json.choices?.[0]?.message?.content ?? "").trim();
}

export const superAiChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const raw = (input ?? {}) as {
      messages?: InMsg[];
      provider?: ProviderPayload;
      task?: string;
      systemExtra?: string;
    };
    const messages = Array.isArray(raw.messages) ? raw.messages : [];
    const cleaned = messages
      .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-16)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 6000) }));
    if (cleaned.length === 0) throw new Error("Keine Nachricht");
    if (!raw.provider?.id) throw new Error("Kein Provider gewählt");
    return {
      messages: cleaned,
      provider: raw.provider,
      task: String(raw.task ?? "general").slice(0, 40),
      systemExtra: String(raw.systemExtra ?? "").slice(0, 12000),
    };
  })
  .handler(async ({ data }): Promise<SuperAiResult> => {
    const p = data.provider;
    const system =
      data.systemExtra ||
      "Du bist Super-AI in Nose-Pushup. Antworte auf Deutsch, motivierend und konkret.";

    let reply = "";
    if (p.id === "lovable") {
      reply = await callLovable(p.model || "google/gemini-3-flash-preview", system, data.messages);
    } else if (p.id === "anthropic") {
      if (!p.apiKey) throw new Error("Anthropic API-Key fehlt");
      reply = await callAnthropic(p.apiKey, p.model, system, data.messages);
    } else if (p.id === "google") {
      if (!p.apiKey) throw new Error("Google API-Key fehlt");
      reply = await callGoogle(p.apiKey, p.model, system, data.messages);
    } else if (p.id === "openai") {
      if (!p.apiKey) throw new Error("OpenAI API-Key fehlt");
      reply = await callOpenAICompat("https://api.openai.com/v1", p.apiKey, p.model, system, data.messages);
    } else if (p.id === "custom") {
      if (!p.apiKey || !p.baseUrl) throw new Error("Custom: API-Key und Base-URL nötig");
      reply = await callOpenAICompat(p.baseUrl, p.apiKey, p.model, system, data.messages);
    } else {
      throw new Error("Unbekannter Provider");
    }

    return {
      reply: reply || "…",
      provider: p.id,
      model: p.model,
      task: data.task,
    };
  });
