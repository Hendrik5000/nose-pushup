/** Versionierte, streng validierte Aktionskarten, die Mira im Chat vorschlagen darf. */

import { putAlo, type AloRecord } from "./alo-store";

export const MIRA_ACTION_SCHEMA_VERSION = 1 as const;
export const MIRA_ACTION_MAX_TEXT = 600;

export type MiraActionCard = {
  type: "createAloEntry";
  schemaVersion: typeof MIRA_ACTION_SCHEMA_VERSION;
  kind: "task" | "note";
  title: string;
  text: string;
  due?: string;
};

/** Nur endliche, versionierte Formen; alles andere wird verworfen statt geraten. */
export function validateMiraActionCard(value: unknown): MiraActionCard | null {
  if (!isRecord(value) || value.schemaVersion !== MIRA_ACTION_SCHEMA_VERSION) return null;
  if (value.type !== "createAloEntry") return null;
  if (!hasExactKeys(value, ["type", "schemaVersion", "kind", "title", "text"], ["due"])) return null;
  if (value.kind !== "task" && value.kind !== "note") return null;
  const title = safeText(value.title, 80);
  const text = safeText(value.text, MIRA_ACTION_MAX_TEXT);
  if (!title || !text) return null;
  if (value.due === undefined) {
    return {
      type: "createAloEntry",
      schemaVersion: MIRA_ACTION_SCHEMA_VERSION,
      kind: value.kind,
      title,
      text,
    };
  }
  const due = safeDueDate(value.due);
  if (!due) return null;
  return {
    type: "createAloEntry",
    schemaVersion: MIRA_ACTION_SCHEMA_VERSION,
    kind: value.kind,
    title,
    text,
    due,
  };
}

/**
 * Schreibt den Eintrag nur, wenn diese Funktion durch einen ausdruecklichen
 * Nutzerklick in der UI laeuft. Niemals aus automatischen Antwortpfaden aufrufen.
 */
export function saveMiraActionEntry(action: MiraActionCard, userId: string): AloRecord {
  if (!userId) throw new Error("Bitte zuerst anmelden.");
  const body: Record<string, unknown> =
    action.kind === "task"
      ? {
          title: action.title,
          text: action.text,
          done: false,
          source: "Mira",
          ...(action.due ? { due: action.due } : {}),
        }
      : {
          title: action.title,
          text: action.text,
          url: "",
          area: "all",
          collectionId: "all",
          source: "Mira",
        };
  return putAlo(action.kind === "task" ? "task" : "capture", body, undefined, userId);
}

export const MIRA_ACTION_INSTRUCTIONS = [
  "Aufgaben & Notizen (optional): Wenn die Nutzereingabe ausdruecklich darum bittet, etwas festzuhalten, zu erinnern, als Aufgabe oder Notiz zu speichern, fuege der JSON-Antwort genau ein action-Objekt hinzu.",
  'Form: {"reply":"...","action":{"type":"createAloEntry","schemaVersion":1,"kind":"task","title":"...","text":"..."}}.',
  'kind ist "task" fuer Aufgaben oder "note" fuer Notizen; optionales "due" nur als YYYY-MM-DD und nur, wenn die Nutzereingabe ein klares Datum nennt.',
  "title maximal 80 Zeichen, text maximal 600 Zeichen. Inhalt ausschliesslich aus der Nutzereingabe oder dem aktuellen Chat; erfinde keine Aufgaben, Fristen oder Details.",
  "Keine URLs, HTML, JavaScript oder ausfuehrbaren Inhalte. action und visual schliessen sich gegenseitig aus.",
  "Das Speichern passiert nur nach ausdruecklichem Klick des Nutzers auf der festen Alo-Karte; erwaehne im reply knapp, dass die Bestaetigungskarte bereitsteht.",
  "Ohne ausdruecklichen Speicher-, Erinnerungs- oder Notizwunsch der Nutzereingabe kein action-Feld.",
].join(" ");

function safeDueDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(value + "T00:00:00Z");
  if (Number.isNaN(parsed.getTime())) return null;
  const parts = value.split("-").map((part) => parseInt(part, 10));
  if (
    parsed.getUTCFullYear() !== parts[0] ||
    parsed.getUTCMonth() !== parts[1] - 1 ||
    parsed.getUTCDate() !== parts[2]
  )
    return null;
  return value;
}

function safeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (
    text.length < 1 ||
    text.length > maxLength ||
    /[<>]/.test(text) ||
    [...text].some(
      (character) => character.charCodeAt(0) <= 31 || character.charCodeAt(0) === 127,
    ) ||
    /(?:https?:\/\/|www\.)/i.test(text)
  )
    return null;
  return text;
}

function hasExactKeys(
  value: Record<string, unknown>,
  required: string[],
  optional: string[] = [],
): boolean {
  const allowed = new Set([...required, ...optional]);
  const keys = Object.keys(value);
  return (
    required.every((key) => Object.prototype.hasOwnProperty.call(value, key)) &&
    keys.every((key) => allowed.has(key))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
