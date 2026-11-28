/** Baut den streng begrenzten Kontext fuer Mira-Antwortentwuerfe im Nexus-Chat. */

export const MIRA_REPLY_DRAFT_SYSTEM = [
  "Du hilfst beim Verfassen eines kurzen Antwortentwurfs für den Nexus-Chat.",
  "Basere den Entwurf ausschließlich auf dem bereitgestellten Verlauf; erfinde keine Fakten, Zusagen oder persönlichen Daten.",
  "Antworte ausschließlich mit dem Entwurfstext: keine Einleitung, keine Anführungszeichen um den gesamten Text, keine Codeblöcke, kein JSON, keine Karten.",
  "Der Entwurf ist höchstens 600 Zeichen lang, freundlich und passt Ton und Länge an die Unterhaltung an.",
  "Ist keine sinnvolle Antwort möglich, antworte mit genau: KEIN_ENTWURF",
  "Der Entwurf wird nur in das Eingabefeld eingefügt und niemals automatisch gesendet.",
].join(" ");

export type NexusDraftMessage = { author: string; own: boolean; content: string };

const MAX_MESSAGES = 30;
const MAX_CHARS = 4000;

function cleanLine(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[<>]/g, "")
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, " ")
    .trim();
}

/** Baut den Verlauf-Text; null, wenn keine fremde Nachricht zum Antworten da ist. */
export function buildNexusReplyDraftHistory(
  input: readonly NexusDraftMessage[],
): string | null {
  const lines: string[] = [];
  let hasForeign = false;
  let chars = 0;
  for (const message of [...input]
    .filter((message) => message && typeof message === "object")
    .slice(-MAX_MESSAGES)) {
    const content = cleanLine(message.content);
    if (!content) continue;
    if (!message.own) hasForeign = true;
    const author = cleanLine(message.author) || "Mitglied";
    const line = author + ": " + content;
    if (chars + line.length > MAX_CHARS) break;
    lines.push(line);
    chars += line.length;
  }
  return hasForeign && lines.length ? lines.join("\n") : null;
}

export function buildNexusReplyDraftPrompt(
  roomName: unknown,
  myName: unknown,
  transcript: string,
): string {
  const room = cleanLine(roomName) || "Nexus Chat";
  const name = cleanLine(myName) || "Du";
  return (
    'Entwirf eine passende kurze Antwort für den Chat-Raum "' + room + '". ' +
    "Nachrichtenverlauf (älteste zuerst; Nachrichten von " + name + " sind deine eigene Sicht):\n" +
    transcript +
    "\n\nAntworte ausschließlich mit dem Entwurfstext."
  );
}

/** Entfernt Codezäune und umschließende Anführungszeichen; null, wenn nichts Verwertbares bleibt. */
export function cleanReplyDraftText(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let text = raw.trim();
  text = text
    .replace(/^```(?:[a-zA-Z]*)\n?/, "")
    .replace(/\n?```$/, "")
    .trim();
  if (/^KEIN_ENTWURF$/i.test(text)) return null;
  if (
    text.length >= 2 &&
    ((text.startsWith('"') && text.endsWith('"')) ||
      (text.startsWith("'") && text.endsWith("'")))
  ) {
    text = text.slice(1, -1).trim();
  }
  if (!text || text.length > 2000) return null;
  return text;
}
