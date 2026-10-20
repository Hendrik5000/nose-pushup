import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, test } from "node:test";
import { loadChatStore } from "../src/lib/local-chat";

const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const oldLocalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
const storageKey = "nose-pushup-local-chat:member-7";
const oldWelcome =
  "Willkommen im lokalen Chat von Nosy Push-Ups! Nachrichten bleiben auf diesem Gerät (localStorage).";
const aloWelcome =
  "Willkommen im lokalen Chat von Alo! Nachrichten bleiben auf diesem Gerät (localStorage).";

function mockStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const writes: Array<[string, string]> = [];
  const localStorage = {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
      writes.push([key, value]);
    },
  };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage },
  });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: localStorage });
  return { values, writes };
}

afterEach(() => {
  if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow);
  else Reflect.deleteProperty(globalThis, "window");
  if (oldLocalStorage) Object.defineProperty(globalThis, "localStorage", oldLocalStorage);
  else Reflect.deleteProperty(globalThis, "localStorage");
});

test("new local chat store welcomes users to Alo", () => {
  const { values } = mockStorage();
  const store = loadChatStore("member-7");
  assert.equal(store.messages[0]?.user_id, "system");
  assert.equal(store.messages[0]?.content, aloWelcome);
  assert.deepEqual([...values.keys()], [storageKey]);
});

test("load normalizes only the exact legacy system welcome and preserves stored data", () => {
  const original = {
    rooms: [{ id: "room-1", name: "Allgemein", description: "Nexus Chat" }],
    messages: [
      {
        id: "legacy-1",
        room_id: "room-1",
        conversation_id: null,
        user_id: "system",
        content: oldWelcome,
        created_at: "2024-01-02T03:04:05.000Z",
        edited_at: null,
        reply_to_id: null,
      },
      {
        id: "user-1",
        room_id: "room-1",
        conversation_id: null,
        user_id: "member-7",
        content: oldWelcome,
        created_at: "2024-01-03T03:04:05.000Z",
        edited_at: null,
        reply_to_id: null,
      },
      {
        id: "other-system-1",
        room_id: "room-1",
        conversation_id: null,
        user_id: "system",
        content: `${oldWelcome} `,
        created_at: "2024-01-04T03:04:05.000Z",
        edited_at: null,
        reply_to_id: null,
      },
    ],
    reactions: [{ id: "reaction-1", message_id: "user-1", user_id: "member-7", emoji: "👍" }],
    dms: [{ id: "dm-1", other_id: "member-8", other_name: "Mira", last_message_at: "2024-01-05" }],
  };
  const { values, writes } = mockStorage({
    [storageKey]: JSON.stringify(original),
    "nose-pushup-local-chat:another-user": "untouched",
  });

  const loaded = loadChatStore("member-7");
  const expected = structuredClone(original);
  expected.messages[0]!.content = aloWelcome;
  assert.deepEqual(loaded, expected);
  assert.deepEqual(JSON.parse(values.get(storageKey)!), expected);
  assert.deepEqual(
    writes.map(([key]) => key),
    [storageKey],
  );
  assert.equal(values.get("nose-pushup-local-chat:another-user"), "untouched");
});

test("health card accent follows semantic theme colors and keeps contrast overrides", () => {
  const css = readFileSync(new URL("../src/health-reference.css", import.meta.url), "utf8");
  const base = css.match(
    /html\[data-design-style="performance"\] \.sport-health-page\s*\{([^}]*)\}/,
  )?.[1];
  assert.ok(base, "health tokens remain scoped to the performance health page");
  assert.match(base!, /--health-blue:\s*var\(--primary\)/);
  assert.match(base!, /--health-blue-ink:\s*var\(--primary-foreground\)/);
  assert.match(
    css,
    /\.health-bento-grid\s*>\s*\.health-energy-card\s*\{[^}]*background:\s*linear-gradient\([\s\S]*?var\(--primary\) 88%, var\(--primary-foreground\)[\s\S]*?var\(--health-blue\)/,
  );

  const contrast = css.match(
    /html\[data-design-style="performance"\]\[data-theme="contrast"\] \.sport-health-page\s*\{([^}]*)\}/,
  )?.[1];
  assert.ok(contrast, "contrast theme keeps an explicit health accent override");
  assert.match(contrast!, /--health-blue:\s*#ffeb00/i);
  assert.match(contrast!, /--health-blue-ink:\s*#000000/i);
  assert.match(
    css,
    /html\[data-design-style="performance"\]\[data-theme="contrast"\][\s\S]*?\.health-energy-card\s*\{[^}]*background:\s*var\(--health-blue\)/,
  );
});
