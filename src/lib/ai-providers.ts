/** Client-side BYOK multi-provider config for Super-AI. */

import { clearProviderStorage } from "@/lib/sensitive-storage";
import { getProviderMemory, setProviderMemory } from "@/lib/ai-provider-memory";
import {
  GEMINI_MODEL_LABELS,
  isGeminiModelMode,
  resolveGeminiModelForTask,
  type GeminiModelMode,
} from "@/lib/gemini-models";

export { GEMINI_MODEL_LABELS, isGeminiModelMode, resolveGeminiModelForTask };
export type { GeminiModelMode };

export type ProviderId =
  | "openai"
  | "anthropic"
  | "google"
  | "lovable"
  | "custom"
  | "openrouter"
  | "cerebras"
  | "cloudflare";

export type AiTask =
  | "general"
  | "training_plan"
  | "form_technique"
  | "recovery"
  | "stats_analysis"
  | "chat_summary"
  | "quick_log"
  | "motivation"
  | "science"
  | "creative"
  | "coding"
  | "vision";

export type ProviderConfig = {
  id: ProviderId;
  label: string;
  enabled: boolean;
  apiKey: string;
  baseUrl?: string;
  accountId?: string;
  model: string;
  tasks: AiTask[];
};

export type ProviderCatalogEntry = {
  id: "google" | "openrouter";
  summary: string;
  freeAccess: string;
  models: string[];
  keyUrl: string;
  docsUrl: string;
  supportsImages: boolean;
  requiresClientKey: boolean;
};

/** Only fixed Google Gemini and OpenRouter endpoints/models are enabled. */
export const SUPPORTED_PROVIDER_CATALOG: ProviderCatalogEntry[] = [
  {
    id: "google",
    summary:
      "Google Gemini verwendet deinen eigenen API-Key. Mira sendet Text und ausgewählte Anhänge beim bewussten Senden über Alo an Google.",
    freeAccess:
      "Nur Hydrogen und Flash-Lite sind auswählbar; Google-Tarife, Kontingente oder Abrechnung hängen von deinem Konto ab. Inhalte im Gemini-Free-Tier können laut Google zur Produktverbesserung verwendet werden.",
    models: ["auto", "gemini-4-hydrogen", "gemini-3.1-flash-lite"],
    keyUrl: "https://aistudio.google.com/apikey",
    docsUrl: "https://ai.google.dev/gemini-api/docs/pricing",
    supportsImages: true,
    requiresClientKey: true,
  },
  {
    id: "openrouter",
    summary: "Kostenlose Modelle; der Router wählt ausschließlich Free-Varianten.",
    freeAccess: "Ohne Zahlungsoptionen; max. 20 Anfragen/Min. und 50/Tag. Kein Paid-Fallback.",
    models: ["openrouter/free"],
    keyUrl: "https://openrouter.ai/keys",
    docsUrl: "https://openrouter.ai/docs/quickstart",
    supportsImages: false,
    requiresClientKey: true,
  },
];

export function isSupportedProvider(id: ProviderId): boolean {
  return id === "google" || id === "openrouter";
}

export function isProviderReady(provider: ProviderConfig): boolean {
  return (
    isSupportedProvider(provider.id) &&
    provider.enabled &&
    typeof provider.apiKey === "string" &&
    provider.apiKey.trim().length > 0
  );
}

export const DEFAULT_PROVIDERS: ProviderConfig[] = [
  {
    id: "google",
    label: "Google Gemini (eigener API-Key)",
    enabled: false,
    apiKey: "",
    model: "auto",
    tasks: [
      "general",
      "training_plan",
      "form_technique",
      "recovery",
      "stats_analysis",
      "chat_summary",
      "quick_log",
      "motivation",
      "science",
      "creative",
      "coding",
      "vision",
    ],
  },
  {
    id: "openrouter",
    label: "OpenRouter (Free Models)",
    enabled: false,
    apiKey: "",
    model: "openrouter/free",
    tasks: ["general", "coding", "science", "creative", "chat_summary"],
  },
  {
    id: "openai",
    label: "OpenAI (gesperrt – kostenpflichtige API)",
    enabled: false,
    apiKey: "",
    model: "gpt-4o-mini",
    tasks: ["general", "stats_analysis", "training_plan", "coding", "science"],
  },
  {
    id: "anthropic",
    label: "Anthropic (gesperrt – kostenpflichtige API)",
    enabled: false,
    apiKey: "",
    model: "claude-3-5-haiku-latest",
    tasks: ["form_technique", "recovery", "training_plan", "creative", "science"],
  },
  {
    id: "lovable",
    label: "Lovable Gateway",
    enabled: false,
    apiKey: "",
    model: "google/gemini-3-flash-preview",
    tasks: ["general", "quick_log", "motivation", "vision", "creative"],
  },
  {
    id: "custom",
    label: "Custom (Kosten nicht verifiziert – gesperrt)",
    enabled: false,
    apiKey: "",
    baseUrl: "https://api.example.com/v1",
    model: "my-model",
    tasks: ["general"],
  },
  {
    id: "cerebras",
    label: "Cerebras (Zahlungsmethode erforderlich – gesperrt)",
    enabled: false,
    apiKey: "",
    model: "gpt-oss-120b",
    tasks: ["general", "coding", "science", "creative"],
  },
  {
    id: "cloudflare",
    label: "Cloudflare Workers AI (Tarif nicht verifiziert – gesperrt)",
    enabled: false,
    apiKey: "",
    accountId: "",
    model: "@cf/zai-org/glm-4.7-flash",
    tasks: ["general", "coding", "science", "creative"],
  },
];

function normalizeProviders(list: ProviderConfig[]): ProviderConfig[] {
  return DEFAULT_PROVIDERS.map((defaults) => {
    const found = list.find((provider) => provider.id === defaults.id);
    if (!found) return { ...defaults };
    const merged = { ...defaults, ...found, id: defaults.id, label: defaults.label };
    if (!isSupportedProvider(defaults.id)) {
      return { ...merged, enabled: false, apiKey: "", baseUrl: undefined, accountId: undefined };
    }
    if (defaults.id === "google") {
      const model: GeminiModelMode = isGeminiModelMode(found.model) ? found.model : "auto";
      return {
        ...merged,
        enabled: Boolean(found.enabled),
        apiKey: typeof found.apiKey === "string" ? found.apiKey.slice(0, 500) : "",
        model,
        baseUrl: undefined,
        accountId: undefined,
      };
    }
    return {
      ...merged,
      enabled: Boolean(found.enabled),
      apiKey: typeof found.apiKey === "string" ? found.apiKey.slice(0, 500) : "",
      model: "openrouter/free",
      baseUrl: undefined,
      accountId: undefined,
    };
  });
}

/** Keys exist only in this tab's live JavaScript memory; reload starts with an empty config. */
export function loadProviders(userId?: string | null): ProviderConfig[] {
  if (typeof window === "undefined") return structuredClone(DEFAULT_PROVIDERS);
  clearProviderStorage();
  const saved = getProviderMemory<ProviderConfig[]>(userId);
  return saved ? normalizeProviders(saved) : structuredClone(DEFAULT_PROVIDERS);
}

export function saveProviders(list: ProviderConfig[], userId?: string | null): void {
  if (typeof window === "undefined") {
    throw new Error("Provider-Schlüssel können nur im Browser-Arbeitsspeicher gehalten werden.");
  }
  setProviderMemory(userId, normalizeProviders(list));
}

/** Classify user message into a task for model routing. */
export function classifyTask(
  text: string,
  opts?: { hasImage?: boolean; hasVisionAttachment?: boolean },
): AiTask {
  if (opts?.hasImage || opts?.hasVisionAttachment) return "vision";
  const t = text.toLowerCase();
  if (/(hab|habe|gemacht|geschafft|absolviert|logg|logge)/.test(t) && /\d+/.test(t))
    return "quick_log";
  if (/(plan|programm|split|wochenplan|trainingsplan)/.test(t)) return "training_plan";
  // Specialized domains before broad training "form" keywords (avoid "Formel" → form_technique)
  if (/(bild|foto|skizze|screenshot|siehst du|was ist auf)/.test(t)) return "vision";
  if (/(physik|chemie|biologie|mathe|theorem|wissenschaft|paper|studie|\bformel\b)/.test(t))
    return "science";
  if (/(gedicht|geschichte|roman|kreativ|erzähl|metapher|songtext|skript)/.test(t))
    return "creative";
  if (/(code|typescript|python|bug|funktion|api|sql|regex|compili)/.test(t)) return "coding";
  if (/(?:\bform\b|technik|haltung|nacken|rücken|schulter|winkel)/.test(t)) return "form_technique";
  if (/(regen|recovery|schmerz|pause|müde|schlaf|überlast)/.test(t)) return "recovery";
  if (/(statistik|fortschritt|woche|trend|analyse|wie war)/.test(t)) return "stats_analysis";
  if (/(chat|nachricht|raum|dm|zusammenfassung|freund)/.test(t)) return "chat_summary";
  if (/(motiv|nicht lust|faul|durchhalten|streak)/.test(t)) return "motivation";
  return "general";
}

export type ProviderSelection = {
  provider: ProviderConfig | null;
  reason: "task_preference" | "first_enabled_fallback" | "no_provider";
};

const TASK_LABELS: Record<AiTask, string> = {
  general: "allgemeine Anfrage",
  training_plan: "Trainingsplan",
  form_technique: "Form und Technik",
  recovery: "Erholung",
  stats_analysis: "Statistikanalyse",
  chat_summary: "Chat-Zusammenfassung",
  quick_log: "schnelles Trainingsprotokoll",
  motivation: "Motivation",
  science: "wissenschaftliche Frage",
  creative: "kreatives Schreiben",
  coding: "Programmieren / Technik",
  vision: "Bild oder PDF verstehen",
};

export function selectProvider(
  providers: ProviderConfig[],
  task: AiTask,
  options?: { requiresGoogle?: boolean },
): ProviderSelection {
  const enabled = providers.filter(isProviderReady);
  if (enabled.length === 0) return { provider: null, reason: "no_provider" };
  if (options?.requiresGoogle) {
    const google = enabled.find((provider) => provider.id === "google");
    return google
      ? { provider: google, reason: "task_preference" }
      : { provider: null, reason: "no_provider" };
  }
  const preferred = enabled.find((provider) => provider.tasks.includes(task));
  return preferred
    ? { provider: preferred, reason: "task_preference" }
    : { provider: enabled[0], reason: "first_enabled_fallback" };
}

export function describeProviderSelection(selection: ProviderSelection, task: AiTask): string {
  if (!selection.provider) return "Kein aktivierter Anbieter mit den nötigen Zugangsdaten.";
  const taskLabel = TASK_LABELS[task];
  if (selection.provider.id === "google") {
    const model = resolveGeminiModelForTask(task, selection.provider.model);
    return `„${taskLabel}“ wird über Google Gemini (${model}) verarbeitet.`;
  }
  if (selection.reason === "task_preference") {
    return `„${taskLabel}“ ist bei ${selection.provider.label} als Aufgabenbereich eingetragen; gewählt wird der erste aktivierte passende Anbieter.`;
  }
  return `Kein aktivierter Anbieter ist für „${taskLabel}“ eingetragen; deshalb wird der erste aktivierte Anbieter in der Liste (${selection.provider.label}) gewählt.`;
}

export function providerLabel(id: ProviderId | string): string {
  return DEFAULT_PROVIDERS.find((provider) => provider.id === id)?.label ?? id;
}

export function enabledProviderSummary(providers: ProviderConfig[]): string {
  const on = providers.filter(isProviderReady);
  if (on.length === 0) return "Keine Anbieter aktiv";
  return on.map((provider) => provider.label).join(", ");
}

export function toPayload(provider: ProviderConfig) {
  return {
    id: provider.id,
    apiKey: provider.apiKey,
    baseUrl: provider.baseUrl,
    accountId: provider.id === "cloudflare" ? provider.accountId : undefined,
    model: provider.model,
  };
}
