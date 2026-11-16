export const MIRA_NEXUS_THREAD_STORAGE_PREFIX = "alo-nexus-mira-thread";

export type MiraNexusMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  at: string;
};

export function miraNexusThreadKey(userId: string): string {
  return `${MIRA_NEXUS_THREAD_STORAGE_PREFIX}:${userId}`;
}

export function loadMiraNexusThread(userId: string): MiraNexusMessage[] {
  if (typeof window === "undefined" || !userId) return [];
  try {
    const raw = window.localStorage.getItem(miraNexusThreadKey(userId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (entry): entry is MiraNexusMessage =>
          !!entry &&
          typeof entry === "object" &&
          typeof (entry as MiraNexusMessage).id === "string" &&
          ((entry as MiraNexusMessage).role === "user" ||
            (entry as MiraNexusMessage).role === "assistant") &&
          typeof (entry as MiraNexusMessage).content === "string",
      )
      .slice(-200);
  } catch {
    return [];
  }
}

export function saveMiraNexusThread(userId: string, messages: MiraNexusMessage[]): void {
  if (typeof window === "undefined" || !userId) return;
  try {
    window.localStorage.setItem(miraNexusThreadKey(userId), JSON.stringify(messages.slice(-200)));
  } catch {
    return;
  }
}

export function newMiraNexusMessageId(): string {
  return `mira-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function buildMiraNexusHistory(messages: MiraNexusMessage[]) {
  return messages
    .filter((m) => m.content.trim())
    .slice(-16)
    .map((m) => ({ role: m.role, content: m.content }));
}

export function miraNexusUnavailableText(): string {
  return "⚠️ Kein aktiver KI-Anbieter. Hinterlege in Mira unter Zugangsdaten einen API-Schlüssel, dann antwortet Mira hier.";
}

export function miraNexusErrorText(): string {
  return "⚠️ Mira konnte gerade nicht antworten. Bitte später erneut versuchen.";
}
