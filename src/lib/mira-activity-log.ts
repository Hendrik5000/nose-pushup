/** Lokales Aktivitaetsprotokoll: was Mira auf diesem Gerät gemacht hat. Kein Cloud-Sync. */

import { getAloOwner } from "./alo-store";

export type MiraActivityKind = "chat" | "entry" | "browser" | "pointer" | "error";

export type MiraActivityEntry = {
  kind: MiraActivityKind;
  label: string;
  at: string;
};

const ACTIVITY_KEY = "alo-mira-activity-v1";
const ACTIVITY_MAX_ENTRIES = 200;
const ACTIVITY_MAX_AGE_DAYS = 7;
const KINDS = new Set<MiraActivityKind>(["chat", "entry", "browser", "pointer", "error"]);

export const MIRA_ACTIVITY_KIND_LABELS: Record<MiraActivityKind, string> = {
  chat: "Anfrage",
  entry: "Gespeichert",
  browser: "Browser",
  pointer: "Bedienung",
  error: "Fehler",
};

function activityKey(userId?: string | null): string {
  const owner = userId ?? getAloOwner();
  return owner ? ACTIVITY_KEY + ":" + owner : ACTIVITY_KEY;
}

function sanitizeLabel(value: unknown): string {
  if (typeof value !== "string") return "";
  const text = value.trim();
  if (text.length < 1 || text.length > 120 || /[<>]/.test(text)) return "";
  return text;
}

/** Zeichnet genau eine Mira-Aktivität auf. Blockierte Speicher werden still ignoriert. */
export function recordMiraActivity(input: {
  userId?: string | null;
  kind: MiraActivityKind;
  label: unknown;
  at?: string;
}): void {
  if (typeof window === "undefined") return;
  if (!KINDS.has(input.kind)) return;
  const label = sanitizeLabel(input.label);
  if (!label) return;
  const at =
    typeof input.at === "string" && !Number.isNaN(new Date(input.at).getTime())
      ? input.at
      : new Date().toISOString();
  let entries: MiraActivityEntry[];
  try {
    const parsed: unknown = JSON.parse(
      window.localStorage.getItem(activityKey(input.userId)) ?? "[]",
    );
    entries = Array.isArray(parsed) ? (parsed as MiraActivityEntry[]) : [];
    if (!Array.isArray(entries) || !entries.every((row) => row && typeof row === "object"))
      entries = [];
  } catch {
    entries = [];
  }
  const now = new Date(at).getTime();
  const kept = (Array.isArray(entries) ? entries : [])
    .filter((row) => row && KINDS.has(row.kind) && typeof row.label === "string" && typeof row.at === "string")
    .filter((row) => {
      const age = now - new Date(row.at).getTime();
      return Number.isFinite(age) && age >= 0 && age < ACTIVITY_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    });
  const next = [...kept, { kind: input.kind, label, at }]
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(-ACTIVITY_MAX_ENTRIES);
  try {
    window.localStorage.setItem(activityKey(input.userId), JSON.stringify(next));
  } catch {
    /* Protokoll ist optional und bricht nie die eigentliche Aktion. */
  }
}

export function readMiraActivity(userId?: string | null): MiraActivityEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(
      window.localStorage.getItem(activityKey(userId)) ?? "[]",
    );
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    return (parsed as MiraActivityEntry[])
      .filter(
        (row) =>
          row &&
          KINDS.has(row.kind) &&
          typeof row.label === "string" &&
          typeof row.at === "string" &&
          now - new Date(row.at).getTime() < ACTIVITY_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
      )
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 100);
  } catch {
    return [];
  }
}

/** Deutsch formulierte Protokollzeile fuer die feste Karte. */
export function formatMiraActivityLine(entry: MiraActivityEntry): string {
  return (
    MIRA_ACTIVITY_KIND_LABELS[entry.kind] +
    ": " +
    entry.label +
    " · " +
    new Date(entry.at).toLocaleString("de-DE")
  );
}
