/** Lokale, ehrliche Anfragen-Zaehlung pro Mira-Anbieter/Modell. Keine Token- oder Kostenzahlen. */

import { getAloOwner, localDay } from "./alo-store";
import { recordMiraActivity } from "./mira-activity-log";

export type MiraUsageEntry = {
  provider: string;
  model: string;
  count: number;
  errors: number;
  lastUsed: string;
};

const USAGE_KEY = "alo-mira-usage-v1";
const USAGE_MAX_ENTRIES = 40;
const USAGE_MAX_AGE_DAYS = 30;

function usageKey(userId?: string | null): string {
  const owner = userId ?? getAloOwner();
  return owner ? USAGE_KEY + ":" + owner : USAGE_KEY;
}

function sanitizeName(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  const text = value.trim();
  if (text.length < 1 || text.length > maxLength || /[<>]/.test(text)) return "";
  return text;
}

/** Zaehlt genau eine Mira-Anfrage. Bewusst nur erfolgreich ausgelieferte Antworten. */
export function recordMiraUsage(input: {
  userId?: string | null;
  provider?: unknown;
  model?: unknown;
  ok: boolean;
}): void {
  if (typeof window === "undefined") return;
  const provider = sanitizeName(input.provider, 60);
  if (!provider) return;
  const model = sanitizeName(input.model, 80) || "unbekannt";
  recordMiraActivity({ userId: input.userId, kind: "chat", label: provider + " · " + model });
  const now = new Date();
  let entries: MiraUsageEntry[];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(usageKey(input.userId)) ?? "[]");
    entries = Array.isArray(parsed) ? (parsed as MiraUsageEntry[]) : [];
    if (!Array.isArray(entries) || !entries.every((row) => row && typeof row === "object")) entries = [];
  } catch {
    entries = [];
  }
  const existing = entries.find((row) => row && row.provider === provider && row.model === model);
  const next: MiraUsageEntry = existing
    ? {
        ...existing,
        count: existing.count + 1,
        errors: existing.errors + (input.ok ? 0 : 1),
        lastUsed: now.toISOString(),
      }
    : {
        provider,
        model,
        count: 1,
        errors: input.ok ? 0 : 1,
        lastUsed: now.toISOString(),
      };
  const kept = entries
    .filter((row) => row && row !== existing && row.provider && row.model)
    .filter((row) => {
      const age = now.getTime() - new Date(row.lastUsed).getTime();
      return Number.isFinite(age) && age < USAGE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    })
    .filter((row) => row.provider !== next.provider || row.model !== next.model);
  const pruned = [next, ...kept]
    .sort((a, b) => b.lastUsed.localeCompare(a.lastUsed))
    .slice(0, USAGE_MAX_ENTRIES);
  try {
    window.localStorage.setItem(usageKey(input.userId), JSON.stringify(pruned));
  } catch {
    /* Volles oder blockiertes Gerät: Zaehlung ist optional, nie ein Fehler. */
  }
}

export function readMiraUsage(userId?: string | null): MiraUsageEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(usageKey(userId)) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    return (parsed as MiraUsageEntry[])
      .filter(
        (row) =>
          row &&
          typeof row.provider === "string" &&
          typeof row.model === "string" &&
          typeof row.count === "number" &&
          row.count > 0 &&
          typeof row.errors === "number" &&
          typeof row.lastUsed === "string" &&
          now - new Date(row.lastUsed).getTime() < USAGE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
      )
      .sort((a, b) => b.count - a.count);
  } catch {
    return [];
  }
}

/** Deutsch formulierte Zusammenfassung fuer die Einstellungs-Karte. */
export function formatMiraUsageLine(entry: MiraUsageEntry): string {
  const day = localDay(new Date(entry.lastUsed));
  return (
    entry.provider +
    " · " +
    entry.model +
    ": " +
    entry.count.toLocaleString("de-DE") +
    " Anfragen" +
    (entry.errors ? ", " + entry.errors.toLocaleString("de-DE") + " Fehler" : "") +
    ", zuletzt " +
    day
  );
}
