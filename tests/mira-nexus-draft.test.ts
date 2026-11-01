import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { loadChatStore } from "../src/lib/local-chat";
import { getDraft, saveDraft } from "../src/lib/chat-extras";
import { setAloOwner } from "../src/lib/alo-store";
import {
  handoffMiraTextToNexus,
  previewMiraNexusDraft,
  validateNexusHandoffTarget,
} from "../src/lib/mira-nexus-draft";

function withStorage(fn: (events: string[]) => void) {
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const local = new Map<string, string>();
  const session = new Map<string, string>();
  const events: string[] = [];
  const createStorage = (values: Map<string, string>) => ({
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
  const localStorageMock = createStorage(local);
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: localStorageMock,
      sessionStorage: createStorage(session),
      dispatchEvent: (event: Event) => {
        events.push(event.type);
        return true;
      },
    },
  });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: localStorageMock,
  });
  setAloOwner("account-a");
  try {
    fn(events);
  } finally {
    setAloOwner(null);
    if (windowDescriptor) Object.defineProperty(globalThis, "window", windowDescriptor);
    else Reflect.deleteProperty(globalThis, "window");
    if (storageDescriptor) Object.defineProperty(globalThis, "localStorage", storageDescriptor);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
}

const handoff = (overrides: Partial<Parameters<typeof handoffMiraTextToNexus>[0]> = {}) =>
  handoffMiraTextToNexus({
    userId: "account-a",
    roomId: "room-a",
    availableRoomIds: ["room-a"],
    text: "Ausgewählter Mira-Text\nmit Zeilenumbruch",
    expectedDraft: "",
    choice: null,
    ...overrides,
  });

test("account changes and stale rooms fail closed without touching an existing draft", () =>
  withStorage(() => {
    saveDraft("account-a", "room", "room-a", "Vorhandener Entwurf");
    setAloOwner("account-b");
    assert.throws(
      () => handoff({ expectedDraft: "Vorhandener Entwurf", choice: "replace" }),
      /Konto geändert/,
    );
    assert.equal(getDraft("account-a", "room", "room-a"), "Vorhandener Entwurf");
    assert.equal(window.sessionStorage.getItem("alo-open-nexus"), null);

    setAloOwner("account-a");
    assert.throws(
      () =>
        handoff({
          availableRoomIds: ["another-room"],
          expectedDraft: "Vorhandener Entwurf",
          choice: "replace",
        }),
      /nicht mehr verfügbar/,
    );
    assert.equal(getDraft("account-a", "room", "room-a"), "Vorhandener Entwurf");
    assert.equal(window.sessionStorage.getItem("alo-open-nexus"), null);
  }));

test("existing composer drafts stay untouched until append or replace is explicitly chosen", () =>
  withStorage(() => {
    const original = "Mein noch nicht gesendeter Entwurf";
    const incoming = "Ausgewählte Mira-Antwort";
    saveDraft("account-a", "room", "room-a", original);
    assert.equal(previewMiraNexusDraft(original, incoming, null), original);
    assert.throws(
      () => handoff({ text: incoming, expectedDraft: original, choice: null }),
      /Anhängen oder Ersetzen/,
    );
    assert.equal(getDraft("account-a", "room", "room-a"), original);
    assert.equal(window.sessionStorage.getItem("alo-open-nexus"), null);

    assert.equal(
      handoff({ text: incoming, expectedDraft: original, choice: "append" }),
      `${original}\n\n${incoming}`,
    );
    assert.equal(getDraft("account-a", "room", "room-a"), `${original}\n\n${incoming}`);
    const request = JSON.parse(window.sessionStorage.getItem("alo-open-nexus") ?? "null");
    assert.deepEqual(request, { kind: "room", id: "room-a", userId: "account-a" });
  }));

test("a changed draft is not overwritten by a stale preview; replace uses only the selected Mira text", () =>
  withStorage(() => {
    saveDraft("account-a", "room", "room-a", "Entwurf vor dem Öffnen");
    saveDraft("account-a", "room", "room-a", "Zwischenzeitlich geändert");
    assert.throws(
      () =>
        handoff({
          expectedDraft: "Entwurf vor dem Öffnen",
          choice: "append",
        }),
      /inzwischen geändert/,
    );
    assert.equal(getDraft("account-a", "room", "room-a"), "Zwischenzeitlich geändert");
    assert.equal(window.sessionStorage.getItem("alo-open-nexus"), null);

    const selectedText = "Nur dieser Mira-Text";
    assert.equal(
      handoff({
        text: selectedText,
        expectedDraft: "Zwischenzeitlich geändert",
        choice: "replace",
      }),
      selectedText,
    );
    assert.equal(getDraft("account-a", "room", "room-a"), selectedText);
  }));

test("the handoff fills only the user-scoped composer draft and never creates a Nexus message", () =>
  withStorage((events) => {
    const before = loadChatStore("account-a").messages.length;
    const selectedText = "  Exakt gewählter Text\nmit Absatz  ";
    handoff({ text: selectedText });
    assert.equal(getDraft("account-a", "room", "room-a"), selectedText);
    assert.equal(loadChatStore("account-a").messages.length, before);
    assert.ok(events.includes("alo-remote-applied"));

    const helper = readFileSync(new URL("../src/lib/mira-nexus-draft.ts", import.meta.url), "utf8");
    const actions = readFileSync(
      new URL("../src/components/alo/ContentActions.tsx", import.meta.url),
      "utf8",
    );
    const chat = readFileSync(
      new URL("../src/components/chat/LocalChatShell.tsx", import.meta.url),
      "utf8",
    );
    const handoffHandler =
      actions
        .split("const openNexusDraft = async () => {")[1]
        ?.split("const hasExistingDraft")[0] ?? "";
    assert.match(helper, /saveDraft\(userId, "room", roomId, nextDraft\)/);
    assert.doesNotMatch(
      helper,
      /postMessage|sendMessage|notifyNexusMessage|superAiChat|loadMessages/,
    );
    assert.doesNotMatch(handoffHandler, /postMessage|onSend|notifyNexusMessage|superAiChat/);
    assert.match(chat, /validateNexusHandoffTarget\(/);
    assert.match(chat, /const text = getDraft\(userId, t\.kind, t\.id\);[\s\S]*?setDraft\(text\)/);
  }));

test("Nexus navigation rejects another account and stale targets while accepting legacy room requests", () => {
  const target = JSON.stringify({ kind: "room", id: "room-a", userId: "account-a" });
  assert.deepEqual(validateNexusHandoffTarget(target, "account-b", ["room-a"]), {
    status: "account-changed",
  });
  assert.deepEqual(validateNexusHandoffTarget(target, "account-a", ["room-b"]), {
    status: "stale-target",
  });
  assert.deepEqual(
    validateNexusHandoffTarget(JSON.stringify({ kind: "room", id: "room-a" }), "account-a", [
      "room-a",
    ]),
    {
      status: "valid",
      target: { kind: "room", id: "room-a" },
    },
  );
});
