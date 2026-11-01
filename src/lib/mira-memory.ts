/**
 * Opt-in long-term memory for Mira. Nothing is sent until the user enables
 * memory and there are saved notes. Cleared on logout via sensitive-storage.
 */

const ENABLED_KEY = "alo-mira-memory-enabled-v1";
const NOTES_KEY = "alo-mira-memory-notes-v1";
const MAX_NOTES = 40;
const MAX_NOTE_LEN = 280;

export type MiraMemoryNote = {
  id: string;
  text: string;
  createdAt: string;
  source: "manual" | "suggested";
};

function scoped(key: string, userId?: string | null) {
  return userId ? `${key}:${userId}` : key;
}

export function isMiraMemoryEnabled(userId?: string | null): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(scoped(ENABLED_KEY, userId)) === "1";
}

export function setMiraMemoryEnabled(on: boolean, userId?: string | null) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(scoped(ENABLED_KEY, userId), on ? "1" : "0");
}

export function loadMiraMemoryNotes(userId?: string | null): MiraMemoryNote[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(scoped(NOTES_KEY, userId));
    if (!raw) return [];
    const list = JSON.parse(raw) as MiraMemoryNote[];
    return Array.isArray(list) ? list.slice(0, MAX_NOTES) : [];
  } catch {
    return [];
  }
}

function saveNotes(notes: MiraMemoryNote[], userId?: string | null) {
  window.localStorage.setItem(scoped(NOTES_KEY, userId), JSON.stringify(notes.slice(0, MAX_NOTES)));
}

export function addMiraMemoryNote(
  text: string,
  userId?: string | null,
  source: MiraMemoryNote["source"] = "manual",
): MiraMemoryNote | null {
  const cleaned = text.trim().replace(/\s+/g, " ").slice(0, MAX_NOTE_LEN);
  if (!cleaned) return null;
  const note: MiraMemoryNote = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    text: cleaned,
    createdAt: new Date().toISOString(),
    source,
  };
  const next = [note, ...loadMiraMemoryNotes(userId)].slice(0, MAX_NOTES);
  saveNotes(next, userId);
  return note;
}

export function removeMiraMemoryNote(id: string, userId?: string | null) {
  saveNotes(
    loadMiraMemoryNotes(userId).filter((n) => n.id !== id),
    userId,
  );
}

export function clearMiraMemory(userId?: string | null) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(scoped(NOTES_KEY, userId));
  window.localStorage.removeItem(scoped(ENABLED_KEY, userId));
}

/** Block for system prompt — only when enabled and notes exist. */
export function miraMemorySystemBlock(userId?: string | null): string | null {
  if (!isMiraMemoryEnabled(userId)) return null;
  const notes = loadMiraMemoryNotes(userId);
  if (!notes.length) return null;
  const lines = notes
    .slice(0, 24)
    .map((n, i) => `${i + 1}. ${n.text}`)
    .join("\n");
  return [
    "LANGZEIT-GEDÄCHTNIS (nur mit Nutzerfreigabe, lokal auf dem Gerät gespeichert):",
    "Nutze diese Notizen, um den Nutzer nicht wiederholen zu lassen. Erfinde nichts darüber hinaus.",
    "Bei Widerspruch gilt die aktuelle Nachricht vor älteren Notizen.",
    lines,
  ].join("\n");
}

/** Heuristic: suggest saving a fact the user stated about themselves. */
export function suggestMemoryFromUserText(text: string): string | null {
  const t = text.trim();
  if (t.length < 12 || t.length > 200) return null;
  if (!/\b(ich|mein|meine|mir)\b/i.test(t)) return null;
  if (/(passwort|api[-\s]?key|token|geheim)/i.test(t)) return null;
  if (/\?$/.test(t)) return null;
  if (/(heiße|wohne|arbeite|studiere|plane|schreibe|möchte|will|mag|hasse|bin)/i.test(t)) {
    return t.slice(0, MAX_NOTE_LEN);
  }
  return null;
}
