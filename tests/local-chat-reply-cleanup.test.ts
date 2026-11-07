import assert from "node:assert/strict";
import test from "node:test";
import {
  deleteMessage,
  loadChatStore,
  saveChatStore,
  type LocalMessage,
} from "../src/lib/local-chat";

const userId = "reply-cleanup-test-user";
const storageKey = `nose-pushup-local-chat:${userId}`;

function withLocalStorage(run: () => void) {
  const values = new Map<string, string>();
  const originalWindow = globalThis.window;
  const originalLocalStorage = globalThis.localStorage;
  Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
  try {
    run();
  } finally {
    Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow });
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: originalLocalStorage,
    });
  }
}

function message(id: string, overrides: Partial<LocalMessage> = {}): LocalMessage {
  return {
    id,
    room_id: "room",
    conversation_id: null,
    user_id: userId,
    content: id,
    created_at: `2026-01-01T00:00:0${id.length}Z`,
    edited_at: null,
    reply_to_id: null,
    ...overrides,
  };
}

function seed(messages: LocalMessage[]) {
  saveChatStore(userId, { rooms: [], messages, reactions: [], dms: [] });
}

test("deleting an own local message clears only its reply references and persists null fallback", () => {
  withLocalStorage(() => {
    const target = message("parent");
    const reply = message("reply", { reply_to_id: target.id });
    const unrelated = message("unrelated", { reply_to_id: "other-parent" });
    seed([target, reply, unrelated]);

    deleteMessage(userId, target.id);

    const store = loadChatStore(userId);
    assert.deepEqual(store.messages, [{ ...reply, reply_to_id: null }, unrelated]);
    assert.equal(
      JSON.parse(globalThis.localStorage.getItem(storageKey)!).messages[0].reply_to_id,
      null,
    );
  });
});

test("attempting to delete another user's message changes no messages or reactions", () => {
  withLocalStorage(() => {
    const foreign = message("foreign", { user_id: "another-user" });
    const reply = message("reply", { reply_to_id: foreign.id });
    const reaction = { id: "reaction", message_id: foreign.id, user_id: userId, emoji: "👍" };
    const store = { rooms: [], messages: [foreign, reply], reactions: [reaction], dms: [] };
    saveChatStore(userId, store);

    deleteMessage(userId, foreign.id);

    assert.deepEqual(loadChatStore(userId), store);
  });
});
