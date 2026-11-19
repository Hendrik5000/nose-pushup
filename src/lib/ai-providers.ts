/** Client-side BYOK multi-provider config for Super-AI. */

import { clearProviderStorage } from "@/lib/sensitive-storage";
import { getProviderMemory, setProviderMemory } from "@/lib/ai-provider-memory";

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
  id: "openrouter";
  summary: string;
  freeAccess: string;
  models: string[];
  keyUrl: string;
  docsUrl: string;
  supportsImages: false;
};

/** Only OpenRouter's Free Models Router is currently allowed in Alo's zero-cost mode. */
export const FREE_PROVIDER_CATALOG: ProviderCatalogEntry[] = [
  {
    id: "openrouter",
    summary: "Kostenlose Modelle; der Router wählt ausschließlich Free-Varianten.",
    freeAccess: "Ohne Zahlungsoptionen; max. 20 Anfragen/Min. und 50/Tag. Kein Paid-Fallback.",
    models: ["openrouter/free"],
    keyUrl: "https://openrouter.ai/keys",
    docsUrl: "https://openrouter.ai/docs/quickstart",
    supportsImages: false,
  },
];

export function isFreeOnlyProvider(id: ProviderId): boolean {
  return id === "openrouter";
}

export const DEFAULT_PROVIDERS: ProviderConfig[] = [
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
    id: "google",
    label: "Google Gemini (nicht für Free-only freigegeben)",
    enabled: false,
    apiKey: "",
    model: "gemini-2.0-flash",
    tasks: ["quick_log", "motivation", "general", "vision", "creative"],
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
    id: "openrouter",
    label: "OpenRouter (Free Models)",
    enabled: false,
    apiKey: "",
    model: "openrouter/free",
    tasks: ["general", "coding", "science", "creative", "chat_summary"],
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
    if (!isFreeOnlyProvider(defaults.id)) {
      return { ...merged, enabled: false, apiKey: "", baseUrl: undefined, accountId: undefined };
    }
    return {
      ...merged,
      enabled: Boolean(found.enabled),
      apiKey: typeof found.apiKey === "string" ? found.apiKey : "",
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
export function classifyTask(text: string, opts?: { hasImage?: boolean }): AiTask {
  if (opts?.hasImage) return "vision";
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
  vision: "Bild verstehen",
};

export function selectProvider(providers: ProviderConfig[], task: AiTask): ProviderSelection {
  const enabled = providers.filter(
    (provider) => isFreeOnlyProvider(provider.id) && provider.enabled && provider.apiKey.trim(),
  );
  if (enabled.length === 0) return { provider: null, reason: "no_provider" };
  const preferred = enabled.find((p) => p.tasks.includes(task));
  return preferred
    ? { provider: preferred, reason: "task_preference" }
    : { provider: enabled[0], reason: "first_enabled_fallback" };
}

export function describeProviderSelection(selection: ProviderSelection, task: AiTask): string {
  if (!selection.provider) return "Kein aktivierter Anbieter mit den nötigen Zugangsdaten.";
  const taskLabel = TASK_LABELS[task];
  if (selection.reason === "task_preference") {
    return `„${taskLabel}“ ist bei ${selection.provider.label} als Aufgabenbereich eingetragen; gewählt wird der erste aktivierte passende Anbieter.`;
  }
  return `Kein aktivierter Anbieter ist für „${taskLabel}“ eingetragen; deshalb wird der erste aktivierte Anbieter in der Liste (${selection.provider.label}) gewählt.`;
}

export function providerLabel(id: ProviderId | string): string {
  return DEFAULT_PROVIDERS.find((provider) => provider.id === id)?.label ?? id;
}

export function enabledProviderSummary(providers: ProviderConfig[]): string {
  const on = providers.filter(
    (provider) => isFreeOnlyProvider(provider.id) && provider.enabled && provider.apiKey.trim(),
  );
  if (on.length === 0) return "Keine Anbieter aktiv";
  return on.map((p) => p.label).join(", ");
}

export function toPayload(p: ProviderConfig) {
  return {
    id: p.id,
    apiKey: p.apiKey,
    baseUrl: p.baseUrl,
    accountId: p.id === "cloudflare" ? p.accountId : undefined,
    model: p.model,
  };
}
