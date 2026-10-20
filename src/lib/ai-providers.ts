/** Client-side BYOK multi-provider config for Super-AI. */

import { providersStorageKey } from "@/lib/sensitive-storage";

export type ProviderId = "openai" | "anthropic" | "google" | "lovable" | "custom";

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
  model: string;
  tasks: AiTask[];
};

const STORAGE_KEY = "super-ai-providers-v1";

export const DEFAULT_PROVIDERS: ProviderConfig[] = [
  {
    id: "openai",
    label: "OpenAI",
    enabled: false,
    apiKey: "",
    model: "gpt-4o-mini",
    tasks: ["general", "stats_analysis", "training_plan", "coding", "science"],
  },
  {
    id: "anthropic",
    label: "Anthropic (Claude)",
    enabled: false,
    apiKey: "",
    model: "claude-3-5-haiku-latest",
    tasks: ["form_technique", "recovery", "training_plan", "creative", "science"],
  },
  {
    id: "google",
    label: "Google (Gemini)",
    enabled: false,
    apiKey: "",
    model: "gemini-2.0-flash",
    tasks: ["quick_log", "motivation", "general", "vision", "creative"],
  },
  {
    id: "lovable",
    label: "Lovable Gateway",
    enabled: true,
    apiKey: "",
    model: "google/gemini-3-flash-preview",
    tasks: ["general", "quick_log", "motivation", "vision", "creative"],
  },
  {
    id: "custom",
    label: "Custom (OpenAI-kompatibel)",
    enabled: false,
    apiKey: "",
    baseUrl: "https://api.example.com/v1",
    model: "my-model",
    tasks: ["general"],
  },
];

export function loadProviders(userId?: string | null): ProviderConfig[] {
  try {
    const key = providersStorageKey(userId);
    let raw = localStorage.getItem(key);
    if (!raw && userId) {
      raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        localStorage.setItem(key, raw);
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    if (!raw) return structuredClone(DEFAULT_PROVIDERS);
    const parsed = JSON.parse(raw) as ProviderConfig[];
    if (!Array.isArray(parsed) || parsed.length === 0) return structuredClone(DEFAULT_PROVIDERS);
    return DEFAULT_PROVIDERS.map((d) => {
      const found = parsed.find((p) => p.id === d.id);
      return found ? { ...d, ...found, id: d.id, label: d.label } : d;
    });
  } catch {
    return structuredClone(DEFAULT_PROVIDERS);
  }
}

export function saveProviders(list: ProviderConfig[], userId?: string | null) {
  const sanitized = list.map((p) => ({
    ...p,
    apiKey: typeof p.apiKey === "string" ? p.apiKey : "",
  }));
  localStorage.setItem(providersStorageKey(userId), JSON.stringify(sanitized));
}

/** Classify user message into a task for model routing. */
export function classifyTask(text: string, opts?: { hasImage?: boolean }): AiTask {
  if (opts?.hasImage) return "vision";
  const t = text.toLowerCase();
  if (/(hab|habe|gemacht|geschafft|absolviert|logg|logge)/.test(t) && /\d+/.test(t))
    return "quick_log";
  if (/(plan|programm|split|wochenplan|trainingsplan)/.test(t)) return "training_plan";
  if (/(form|technik|haltung|nacken|rücken|schulter|winkel)/.test(t)) return "form_technique";
  if (/(regen|recovery|schmerz|pause|müde|schlaf|überlast)/.test(t)) return "recovery";
  if (/(statistik|fortschritt|woche|trend|analyse|wie war)/.test(t)) return "stats_analysis";
  if (/(chat|nachricht|raum|dm|zusammenfassung|freund)/.test(t)) return "chat_summary";
  if (/(motiv|nicht lust|faul|durchhalten|streak)/.test(t)) return "motivation";
  if (/(code|typescript|python|bug|funktion|api|sql|regex|compili)/.test(t)) return "coding";
  if (/(physik|chemie|biologie|mathe|theorem|wissenschaft|paper|studie|formel)/.test(t))
    return "science";
  if (/(gedicht|geschichte|roman|kreativ|erzähl|metapher|songtext|skript)/.test(t)) return "creative";
  if (/(bild|foto|skizze|screenshot|siehst du|was ist auf)/.test(t)) return "vision";
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
  const enabled = providers.filter((p) => p.enabled && (p.id === "lovable" || p.apiKey.trim()));
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
  const on = providers.filter((p) => p.enabled && (p.id === "lovable" || p.apiKey.trim()));
  if (on.length === 0) return "Keine Anbieter aktiv";
  return on.map((p) => p.label).join(", ");
}

export function toPayload(p: ProviderConfig) {
  return {
    id: p.id,
    apiKey: p.apiKey,
    baseUrl: p.baseUrl,
    model: p.model,
  };
}
