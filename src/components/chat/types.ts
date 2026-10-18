// ─── Chat types (ported from Nexus-Chat) ─────────────────────────────────────
// Ready for Phase 2 once rooms/messages tables exist in this Supabase project.

export type Room = { id: string; name: string; description: string | null };

export type ChatMessage = {
  id: string;
  room_id: string | null;
  conversation_id: string | null;
  user_id: string;
  content: string;
  created_at: string;
  edited_at: string | null;
  reply_to_id: string | null;
  attachment_url: string | null;
  attachment_type: string | null;
  attachment_name: string | null;
  attachment_size: number | null;
  link_preview: unknown | null;
  pinned_at: string | null;
};

export type Reaction = {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
};

export type DmConversation = {
  id: string;
  other_id: string;
  last_message_at: string;
  kind?: string;
  name?: string | null;
  member_ids?: string[];
};

export type ProfileMap = Record<
  string,
  { display_name: string; avatar_url?: string | null; status_text?: string | null }
>;

export type ActiveTarget = { kind: "room" | "dm"; id: string };

export const MESSAGE_COLUMNS =
  "id, room_id, conversation_id, user_id, content, created_at, edited_at, reply_to_id, attachment_url, attachment_type, attachment_name, attachment_size, link_preview, pinned_at";

export const QUICK_EMOJIS = ["👍", "❤️", "😂", "🔥", "😮", "😢", "🎉", "👀"];

export function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}
