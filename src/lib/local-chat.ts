/** Local-first chat store (no Nexus Supabase). Per-user localStorage. */

export type LocalRoom = { id: string; name: string; description: string | null };

export type LocalMessage = {
  id: string;
  room_id: string | null;
  conversation_id: string | null;
  user_id: string;
  content: string;
  created_at: string;
  edited_at: string | null;
  reply_to_id: string | null;
};

export type LocalReaction = {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
};

export type LocalDm = {
  id: string;
  other_id: string;
  other_name: string;
  last_message_at: string;
};

type Store = {
  rooms: LocalRoom[];
  messages: LocalMessage[];
  reactions: LocalReaction[];
  dms: LocalDm[];
};

function key(userId: string) {
  return `nose-pushup-local-chat:${userId}`;
}

function uid() {
  return crypto.randomUUID();
}

function defaultStore(): Store {
  const generalId = uid();
  const tipsId = uid();
  return {
    rooms: [
      { id: generalId, name: "Allgemein", description: "Nexus Chat" },
      { id: tipsId, name: "Trainings-Tipps", description: "Form, Sets, Recovery" },
    ],
    messages: [
      {
        id: uid(),
        room_id: generalId,
        conversation_id: null,
        user_id: "system",
        content:
          "Willkommen im lokalen Chat von Nosy Push-Ups! Nachrichten bleiben auf diesem Gerät (localStorage).",
        created_at: new Date().toISOString(),
        edited_at: null,
        reply_to_id: null,
      },
    ],
    reactions: [],
    dms: [],
  };
}

export function loadChatStore(userId: string): Store {
  if (typeof window === "undefined") return defaultStore();
  try {
    const raw = localStorage.getItem(key(userId));
    if (!raw) {
      const s = defaultStore();
      saveChatStore(userId, s);
      return s;
    }
    return JSON.parse(raw) as Store;
  } catch {
    return defaultStore();
  }
}

export function saveChatStore(userId: string, store: Store) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key(userId), JSON.stringify(store));
}

export function createRoom(userId: string, name: string): LocalRoom {
  const store = loadChatStore(userId);
  const room: LocalRoom = { id: uid(), name: name.trim(), description: null };
  store.rooms.push(room);
  saveChatStore(userId, store);
  return room;
}

export function getOrCreateDm(userId: string, otherId: string, otherName: string): LocalDm {
  const store = loadChatStore(userId);
  const existing = store.dms.find((d) => d.other_id === otherId);
  if (existing) return existing;
  const dm: LocalDm = {
    id: uid(),
    other_id: otherId,
    other_name: otherName,
    last_message_at: new Date().toISOString(),
  };
  store.dms.unshift(dm);
  saveChatStore(userId, store);
  return dm;
}

export function sendMessage(
  userId: string,
  opts: {
    roomId?: string | null;
    conversationId?: string | null;
    content: string;
    replyToId?: string | null;
  },
): LocalMessage {
  const store = loadChatStore(userId);
  const msg: LocalMessage = {
    id: uid(),
    room_id: opts.roomId ?? null,
    conversation_id: opts.conversationId ?? null,
    user_id: userId,
    content: opts.content.trim(),
    created_at: new Date().toISOString(),
    edited_at: null,
    reply_to_id: opts.replyToId ?? null,
  };
  store.messages.push(msg);
  if (opts.conversationId) {
    const dm = store.dms.find((d) => d.id === opts.conversationId);
    if (dm) dm.last_message_at = msg.created_at;
  }
  saveChatStore(userId, store);
  return msg;
}

export function editMessage(userId: string, messageId: string, content: string) {
  const store = loadChatStore(userId);
  const m = store.messages.find((x) => x.id === messageId);
  if (!m || m.user_id !== userId) return;
  m.content = content.trim();
  m.edited_at = new Date().toISOString();
  saveChatStore(userId, store);
}

export function deleteMessage(userId: string, messageId: string) {
  const store = loadChatStore(userId);
  store.messages = store.messages.filter((m) => m.id !== messageId || m.user_id !== userId);
  store.reactions = store.reactions.filter((r) => r.message_id !== messageId);
  saveChatStore(userId, store);
}

export function toggleReaction(userId: string, messageId: string, emoji: string): LocalReaction[] {
  const store = loadChatStore(userId);
  const existing = store.reactions.find(
    (r) => r.message_id === messageId && r.user_id === userId && r.emoji === emoji,
  );
  if (existing) {
    store.reactions = store.reactions.filter((r) => r.id !== existing.id);
  } else {
    store.reactions.push({
      id: uid(),
      message_id: messageId,
      user_id: userId,
      emoji,
    });
  }
  saveChatStore(userId, store);
  return store.reactions.filter((r) => r.message_id === messageId);
}

export function messagesFor(
  store: Store,
  target: { kind: "room" | "dm"; id: string },
): LocalMessage[] {
  return store.messages
    .filter((m) =>
      target.kind === "room" ? m.room_id === target.id : m.conversation_id === target.id,
    )
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}
