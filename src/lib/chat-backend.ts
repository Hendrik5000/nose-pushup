/** Hybrid chat: Supabase (Nexus schema) when available, else localStorage. */

import { supabase } from "@/integrations/supabase/client";
import {
  createRoom as localCreateRoom,
  deleteMessage as localDelete,
  editMessage as localEdit,
  getOrCreateDm as localGetDm,
  loadChatStore,
  messagesFor,
  saveChatStore,
  sendMessage as localSend,
  toggleReaction as localReact,
  type LocalDm,
  type LocalMessage,
  type LocalReaction,
  type LocalRoom,
} from "@/lib/local-chat";

export type ChatMode = "supabase" | "local";

let cachedMode: ChatMode | null = null;

export async function detectChatMode(): Promise<ChatMode> {
  if (cachedMode) return cachedMode;
  try {
    const { error } = await supabase
      .from("rooms" as never)
      .select("id")
      .limit(1);
    cachedMode = error ? "local" : "supabase";
  } catch {
    cachedMode = "local";
  }
  return cachedMode;
}

export async function loadRooms(): Promise<LocalRoom[]> {
  if ((await detectChatMode()) === "local") {
    return loadChatStore("__probe__").rooms;
  }
  const { data, error } = await supabase
    .from("rooms" as never)
    .select("id, name, description")
    .order("created_at" as never);
  if (error || !data) return [];
  return data as unknown as LocalRoom[];
}

export async function loadRoomsForUser(
  userId: string,
  options: { strict?: boolean } = {},
): Promise<LocalRoom[]> {
  if ((await detectChatMode()) === "local") {
    return loadChatStore(userId).rooms;
  }
  return loadRooms();
}

export async function loadMessages(
  userId: string,
  target: { kind: "room" | "dm"; id: string },
  options: { strict?: boolean } = {},
): Promise<{ messages: LocalMessage[]; reactions: LocalReaction[]; available: boolean }> {
  if ((await detectChatMode()) === "local") {
    const store = loadChatStore(userId);
    const messages = messagesFor(store, target);
    const ids = new Set(messages.map((m) => m.id));
    return {
      available: true,
      messages,
      reactions: store.reactions.filter((r) => ids.has(r.message_id)),
    };
  }

  let q = supabase
    .from("messages" as never)
    .select(
      "id, room_id, conversation_id, user_id, content, created_at, edited_at, reply_to_id" as never,
    )
    .order("created_at" as never, { ascending: false })
    .limit(200);

  q =
    target.kind === "room"
      ? q.eq("room_id" as never, target.id as never)
      : q.eq("conversation_id" as never, target.id as never);

  const { data, error } = await q;
  if (error && options.strict)
    throw new Error(
      "Freigegebene Nexus-Nachrichten konnten nicht geladen werden. Es wurden keine App-Daten an Mira gesendet.",
    );
  const messages = [...((data ?? []) as unknown as LocalMessage[])].reverse();
  const ids = messages.map((m) => m.id);
  let reactions: LocalReaction[] = [];
  if (ids.length) {
    const { data: reacts } = await supabase
      .from("message_reactions" as never)
      .select("id, message_id, user_id, emoji" as never)
      .in("message_id" as never, ids as never);
    reactions = (reacts ?? []) as unknown as LocalReaction[];
  }
  return { messages, reactions, available: !error };
}

export async function postMessage(
  userId: string,
  opts: {
    roomId?: string | null;
    conversationId?: string | null;
    content: string;
    replyToId?: string | null;
  },
): Promise<LocalMessage | null> {
  if ((await detectChatMode()) === "local") {
    return localSend(userId, opts);
  }
  const row = {
    user_id: userId,
    content: opts.content.trim(),
    reply_to_id: opts.replyToId ?? null,
    room_id: opts.roomId ?? null,
    conversation_id: opts.conversationId ?? null,
  };
  const { data, error } = await supabase
    .from("messages" as never)
    .insert(row as never)
    .select(
      "id, room_id, conversation_id, user_id, content, created_at, edited_at, reply_to_id" as never,
    )
    .single();
  if (error || !data) return null;
  return data as unknown as LocalMessage;
}

export async function createChatRoom(userId: string, name: string): Promise<LocalRoom | null> {
  if ((await detectChatMode()) === "local") {
    return localCreateRoom(userId, name);
  }
  const { data, error } = await supabase
    .from("rooms" as never)
    .insert({ name: name.trim(), created_by: userId } as never)
    .select("id, name, description" as never)
    .single();
  if (error || !data) return null;
  return data as unknown as LocalRoom;
}

export async function reactToMessage(
  userId: string,
  messageId: string,
  emoji: string,
): Promise<void> {
  if ((await detectChatMode()) === "local") {
    localReact(userId, messageId, emoji);
    return;
  }
  const { data: existing } = await supabase
    .from("message_reactions" as never)
    .select("id" as never)
    .eq("message_id" as never, messageId as never)
    .eq("user_id" as never, userId as never)
    .eq("emoji" as never, emoji as never)
    .maybeSingle();
  if (existing) {
    await supabase
      .from("message_reactions" as never)
      .delete()
      .eq("id" as never, (existing as { id: string }).id as never);
  } else {
    await supabase.from("message_reactions" as never).insert({
      message_id: messageId,
      user_id: userId,
      emoji,
    } as never);
  }
}

export async function editChatMessage(
  userId: string,
  messageId: string,
  content: string,
): Promise<void> {
  if ((await detectChatMode()) === "local") {
    localEdit(userId, messageId, content);
    return;
  }
  await supabase
    .from("messages" as never)
    .update({ content: content.trim(), edited_at: new Date().toISOString() } as never)
    .eq("id" as never, messageId as never)
    .eq("user_id" as never, userId as never);
}

export async function deleteChatMessage(userId: string, messageId: string): Promise<void> {
  if ((await detectChatMode()) === "local") {
    localDelete(userId, messageId);
    return;
  }
  await supabase
    .from("messages" as never)
    .delete()
    .eq("id" as never, messageId as never)
    .eq("user_id" as never, userId as never);
}

export type { LocalDm, LocalMessage, LocalReaction, LocalRoom };
export { loadChatStore, saveChatStore, localGetDm as getOrCreateLocalDm };

/** One latest message and an exact unread count; RLS remains authoritative. */
export async function loadRoomPreview(userId: string, roomId: string, since?: string) {
  const latestQuery = supabase
    .from("messages" as never)
    .select("content,created_at,user_id" as never)
    .eq("room_id" as never, roomId as never)
    .order("created_at" as never, { ascending: false })
    .limit(1);
  let unreadQuery = supabase
    .from("messages" as never)
    .select("id" as never, { count: "exact", head: true })
    .eq("room_id" as never, roomId as never)
    .neq("user_id" as never, userId as never);
  if (since && Number.isFinite(Date.parse(since)))
    unreadQuery = unreadQuery.gt("created_at" as never, since as never);
  const [latest, unread] = await Promise.all([latestQuery, unreadQuery]);
  return {
    latest: latest.error
      ? null
      : ((latest.data?.[0] ?? null) as {
          content: string;
          created_at: string;
          user_id: string;
        } | null),
    unread: unread.error ? null : (unread.count ?? 0),
    error: Boolean(latest.error || unread.error),
  };
}
