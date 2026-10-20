import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { listAlo, putAlo, setAloOwner, getMiraGrants } from "../src/lib/alo-store";
import { loadSessions } from "../src/lib/super-ai-tools";
import {
  currentMiraSession,
  handoffToMira,
  miraDraftId,
  previewMiraDraft,
  readMiraDraft,
  rememberMiraSession,
} from "../src/lib/mira-handoff";

function withStorage(fn: () => void) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const values = new Map<string, string>();
  const transient = new Map<string, string>();
  const storage = (map: Map<string, string>) => ({
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => map.set(key, value),
    removeItem: (key: string) => map.delete(key),
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: storage(values),
      sessionStorage: storage(transient),
      dispatchEvent: () => true,
    },
  });
  setAloOwner("a");
  try {
    fn();
  } finally {
    setAloOwner(null);
    if (descriptor) Object.defineProperty(globalThis, "window", descriptor);
    else Reflect.deleteProperty(globalThis, "window");
  }
}
const request = (text: string, choice: "keep" | "append" | "new", expectedDraft = "") =>
  handoffToMira({ userId: "a", sessionId: "existing-chat", expectedDraft, text, choice });

test("single selected text is copied exactly, without grants, messages or provider calls", () =>
  withStorage(() => {
    const text = "Einzelner Treffer\n  mit unverändertem Text";
    request(text, "append");
    assert.equal(readMiraDraft("existing-chat"), text);
    assert.deepEqual(loadSessions(), []);
    assert.deepEqual(getMiraGrants(), { training: false, rooms: [] });
    assert.equal(window.sessionStorage.getItem("alo-open-mira"), "existing-chat");
  }));
test("keep does not mutate an existing draft; append matches exact preview", () =>
  withStorage(() => {
    putAlo("draft", { text: "Mein Entwurf" }, "draft:mira");
    const before = JSON.stringify(listAlo());
    request("Neuer Text", "keep", "Mein Entwurf");
    assert.equal(JSON.stringify(listAlo()), before);
    request("Neuer Text", "append", "Mein Entwurf");
    assert.equal(
      readMiraDraft("existing-chat"),
      previewMiraDraft("Mein Entwurf", "Neuer Text", "append"),
    );
    assert.equal(readMiraDraft("existing-chat"), "Mein Entwurf\n\nNeuer Text");
  }));
test("new chat preserves the original draft and stores a separate editable draft with zero messages", () =>
  withStorage(() => {
    putAlo("draft", { text: "Nicht verlieren" }, "draft:mira");
    const target = request("Nur ausgewählter Inhalt", "new", "Nicht verlieren");
    assert.notEqual(target, "existing-chat");
    assert.equal(miraDraftId(target), `draft:mira:${target}`);
    assert.equal(readMiraDraft(target), "Nur ausgewählter Inhalt");
    assert.equal(readMiraDraft("existing-chat"), "Nicht verlieren");
    assert.equal(loadSessions().length, 1);
    assert.equal(loadSessions()[0].id, target);
    assert.deepEqual(loadSessions()[0].messages, []);
  }));
test("concurrent draft changes fail closed rather than overwriting or appending unseen text", () =>
  withStorage(() => {
    putAlo("draft", { text: "Zwischenzeitlich geändert" }, "draft:mira");
    for (const choice of ["keep", "append", "new"] as const)
      assert.throws(() => request("Neu", choice, "Alter Stand"), /inzwischen geändert/);
    assert.equal(readMiraDraft("existing-chat"), "Zwischenzeitlich geändert");
    assert.deepEqual(loadSessions(), []);
  }));
test("active chat and drafts cannot cross accounts", () =>
  withStorage(() => {
    rememberMiraSession("private-a");
    assert.equal(currentMiraSession(), "private-a");
    putAlo("draft", { text: "A privat" }, "draft:mira");
    setAloOwner("b");
    assert.equal(currentMiraSession(), "");
    assert.equal(readMiraDraft("private-a"), "");
    assert.throws(() => request("Neu", "append"), /Konto geändert/);
    setAloOwner("a");
    assert.equal(readMiraDraft("private-a"), "A privat");
  }));
test("handoff UI is explicit and editable; ordinary search has no AI call", () => {
  const ui = readFileSync("src/components/alo/MiraHandoff.tsx", "utf8");
  assert.match(ui, /textarea\s+aria-label="Text für Mira bearbeiten"/);
  assert.match(ui, /Exakter Entwurf im Mira-Chat/);
  assert.match(ui, /Vorhandenen Entwurf behalten/);
  assert.match(ui, /Neuen Chat öffnen/);
  assert.doesNotMatch(ui, /superAiChat|fetch\(|submit\(/);
  const search = readFileSync("src/components/alo/GlobalSearch.tsx", "utf8");
  assert.doesNotMatch(search, /superAiChat|toPayload|pickProvider/);
  const actions = readFileSync("src/components/alo/ContentActions.tsx", "utf8");
  assert.match(actions, /<MiraHandoff userId={userId} text={text}/);
});
