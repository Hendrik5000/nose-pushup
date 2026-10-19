/** Extra Nexus Chat features (local prefs + helpers). */

const PREFS_KEY = (userId: string) => `np-chat-prefs:${userId}`;
const DRAFTS_KEY = (userId: string) => `np-chat-drafts:${userId}`;

export type ChatPrefs = {
  mutedRoomIds: string[];
  favoriteRoomIds: string[];
  pinnedMessageIds: string[];
  lastRead: Record<string, string>; // targetKey -> ISO
};

function canStore() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readJson<T>(key: string, fallback: T): T {
  if (!canStore()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (!canStore()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function loadChatPrefs(userId: string): ChatPrefs {
  return readJson<ChatPrefs>(PREFS_KEY(userId), {
    mutedRoomIds: [],
    favoriteRoomIds: [],
    pinnedMessageIds: [],
    lastRead: {},
  });
}

export function saveChatPrefs(userId: string, prefs: ChatPrefs) {
  writeJson(PREFS_KEY(userId), prefs);
}

export function targetKey(kind: "room" | "dm", id: string) {
  return `${kind}:${id}`;
}

export function toggleMute(userId: string, roomId: string): ChatPrefs {
  const p = loadChatPrefs(userId);
  p.mutedRoomIds = p.mutedRoomIds.includes(roomId)
    ? p.mutedRoomIds.filter((x) => x !== roomId)
    : [...p.mutedRoomIds, roomId];
  saveChatPrefs(userId, p);
  return p;
}

export function toggleFavoriteRoom(userId: string, roomId: string): ChatPrefs {
  const p = loadChatPrefs(userId);
  p.favoriteRoomIds = p.favoriteRoomIds.includes(roomId)
    ? p.favoriteRoomIds.filter((x) => x !== roomId)
    : [roomId, ...p.favoriteRoomIds].slice(0, 20);
  saveChatPrefs(userId, p);
  return p;
}

export function togglePinMessage(userId: string, messageId: string): ChatPrefs {
  const p = loadChatPrefs(userId);
  p.pinnedMessageIds = p.pinnedMessageIds.includes(messageId)
    ? p.pinnedMessageIds.filter((x) => x !== messageId)
    : [messageId, ...p.pinnedMessageIds].slice(0, 30);
  saveChatPrefs(userId, p);
  return p;
}

export function markRead(userId: string, kind: "room" | "dm", id: string, atIso?: string) {
  const p = loadChatPrefs(userId);
  p.lastRead[targetKey(kind, id)] = atIso ?? new Date().toISOString();
  saveChatPrefs(userId, p);
  return p;
}

export function countUnread(
  prefs: ChatPrefs,
  kind: "room" | "dm",
  id: string,
  messages: Array<{ created_at: string; user_id: string }>,
  myId: string,
): number {
  const since = prefs.lastRead[targetKey(kind, id)];
  if (!since) return messages.filter((m) => m.user_id !== myId).length;
  return messages.filter((m) => m.user_id !== myId && m.created_at > since).length;
}

export function loadDrafts(userId: string): Record<string, string> {
  return readJson(DRAFTS_KEY(userId), {});
}

export function saveDraft(userId: string, kind: "room" | "dm", id: string, text: string) {
  const all = loadDrafts(userId);
  const k = targetKey(kind, id);
  if (!text.trim()) delete all[k];
  else all[k] = text;
  writeJson(DRAFTS_KEY(userId), all);
}

export function getDraft(userId: string, kind: "room" | "dm", id: string): string {
  return loadDrafts(userId)[targetKey(kind, id)] ?? "";
}

export const QUICK_REPLIES = [
  { id: "gg", label: "GG 💪", text: "GG! Starkes Training 💪" },
  { id: "streak", label: "Streak", text: "Streak hält — weiter so 🔥" },
  { id: "form", label: "Form", text: "Achte auf die Form, Tempo ist sekundär." },
  { id: "rest", label: "Pause", text: "Gute Idee mit der Pause — Recovery zählt." },
  { id: "join", label: "Mittrainieren", text: "Wer hat Lust, später mitzutrainieren?" },
];

export function workoutShareTemplate(reps: number, exercise = "Push-Ups"): string {
  return `✅ Gerade erledigt: ${reps}× ${exercise}. Wer toppt das?`;
}

export function exportMessagesMarkdown(
  title: string,
  messages: Array<{ content: string; created_at: string; user_id: string }>,
  nameOf: (uid: string) => string,
): string {
  const lines = [`# ${title}`, `Export: ${new Date().toLocaleString("de-DE")}`, ""];
  for (const m of messages) {
    const t = new Date(m.created_at).toLocaleString("de-DE");
    lines.push(`**${nameOf(m.user_id)}** · ${t}`, m.content, "");
  }
  return lines.join("\n");
}

export function searchMessages<
  T extends { content: string; id: string },
>(messages: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return messages.filter((m) => m.content.toLowerCase().includes(q)).slice(-40);
}
