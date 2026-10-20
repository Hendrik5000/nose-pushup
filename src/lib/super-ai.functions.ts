import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

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

/** Per-process sliding window rate limit (user id → timestamps). */
const rateBuckets = new Map<string, number[]>();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_PER_WINDOW = 20;
const MAX_INPUT_CHARS = 12_000;
const MAX_OUTPUT_HINT = 2048;

const MODEL_ALLOW: Record<Exclude<ProviderId, "custom">, string[]> = {
  openai: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1", "o4-mini"],
  anthropic: [
    "claude-3-5-haiku-latest",
    "claude-3-5-sonnet-latest",
    "claude-sonnet-4-20250514",
    "claude-opus-4-20250514",
  ],
  google: ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-2.5-pro"],
  lovable: [
    "google/gemini-3-flash-preview",
    "google/gemini-2.5-flash",
    "openai/gpt-5-mini",
    "openai/gpt-5",
  ],
};

function assertModelAllowed(id: ProviderId, model: string) {
  if (id === "custom") {
    if (!model || model.length > 80 || /[^\w.\/\-:]/.test(model)) {
      throw new Error("Ungültiger Modellname");
    }
    return;
  }
  const list = MODEL_ALLOW[id];
  if (!list.includes(model)) {
    throw new Error(`Modell nicht erlaubt: ${model}`);
  }
}

function isPrivateIp(ip: string): boolean {
  if (ip === "127.0.0.1" || ip === "::1" || ip === "0.0.0.0") return true;
  if (ip.startsWith("10.") || ip.startsWith("192.168.") || ip.startsWith("169.254.")) return true;
  if (ip.startsWith("172.")) {
    const second = Number(ip.split(".")[1] ?? -1);
    if (second >= 16 && second <= 31) return true;
  }
  const lower = ip.toLowerCase();
  if (lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80")) return true;
  return false;
}

/**
 * Validate custom OpenAI-compatible base URL against SSRF.
 * HTTPS only, no credentials in URL, DNS must not resolve to private ranges,
 * optional allowlist via CUSTOM_AI_HOST_ALLOWLIST (comma-separated hosts).
 */
async function assertSafeCustomBaseUrl(raw: string): Promise<string> {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("Custom Base-URL ungültig");
  }
  if (url.protocol !== "https:") throw new Error("Custom Base-URL muss https:// nutzen");
  if (url.username || url.password) throw new Error("URL darf keine Zugangsdaten enthalten");
  if (url.port && url.port !== "443") throw new Error("Nur Standard-HTTPS-Port erlaubt");

  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "metadata.google.internal"
  ) {
    throw new Error("Host nicht erlaubt");
  }

  if (isIP(host) && isPrivateIp(host)) {
    throw new Error("Private IP-Adressen sind gesperrt");
  }

  const allow = (process.env.CUSTOM_AI_HOST_ALLOWLIST ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (allow.length > 0 && !allow.includes(host)) {
    throw new Error(`Host nicht in Allowlist: ${host}`);
  }

  if (!isIP(host)) {
    try {
      const results = await lookup(host, { all: true });
      for (const r of results) {
        if (isPrivateIp(r.address)) {
          throw new Error("Host zeigt auf privates Netzwerk");
        }
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes("privates")) throw e;
      throw new Error("Host-DNS konnte nicht geprüft werden");
    }
  }

  const path = url.pathname.replace(/\/$/, "") || "";
  return `${url.origin}${path}`;
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
  baseUrl: string,
  apiKey: string,
  model: string,
  system: string,
  messages: InMsg[],
) {
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    redirect: "error",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_OUTPUT_HINT,
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

async function callAnthropic(apiKey: string, model: string, system: string, messages: InMsg[]) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    redirect: "error",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_OUTPUT_HINT,
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

async function callGoogle(apiKey: string, model: string, system: string, messages: InMsg[]) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const res = await fetch(url, {
    method: "POST",
    redirect: "error",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      generationConfig: { maxOutputTokens: MAX_OUTPUT_HINT },
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
    redirect: "error",
    headers: {
      "content-type": "application/json",
      "Lovable-API-Key": key,
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_OUTPUT_HINT,
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
    const totalChars = cleaned.reduce((n, m) => n + m.content.length, 0);
    if (totalChars > MAX_INPUT_CHARS) {
      throw new Error(`Eingabe zu lang (max. ${MAX_INPUT_CHARS} Zeichen insgesamt)`);
    }
    if (!raw.provider?.id) throw new Error("Kein Provider gewählt");
    const provider: ProviderPayload = {
      id: raw.provider.id,
      apiKey: String(raw.provider.apiKey ?? "").slice(0, 500),
      baseUrl: raw.provider.baseUrl ? String(raw.provider.baseUrl).slice(0, 300) : undefined,
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
    checkUserRateLimit(userId);

    const p = data.provider;
    if (p.id === "lovable" && !p.model) p.model = "google/gemini-3-flash-preview";
    assertModelAllowed(p.id, p.model);

    const system =
      data.systemExtra ||
      "Du bist Mira, die vielseitige allgemeine KI von Alo (All in one). Antworte auf Deutsch, hilf bei Alltagsfragen, Wissen, Schreiben, Ideen, Lernen und Planung. Sei klar, ehrlich und passe Länge und Ton an die Anfrage an. Behaupte keine App-Daten, die nicht mit der Anfrage gegeben wurden.";

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
      reply = await callOpenAICompat(
        "https://api.openai.com/v1",
        p.apiKey,
        p.model,
        system,
        data.messages,
      );
    } else if (p.id === "custom") {
      if (!p.apiKey || !p.baseUrl) throw new Error("Custom: API-Key und Base-URL nötig");
      const safeBase = await assertSafeCustomBaseUrl(p.baseUrl);
      reply = await callOpenAICompat(safeBase, p.apiKey, p.model, system, data.messages);
    } else {
      throw new Error("Unbekannter Provider");
    }

    return {
      reply: (reply || "…").slice(0, 20_000),
      provider: p.id,
      model: p.model,
      task: data.task,
    };
  });
