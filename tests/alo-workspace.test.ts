import { readAttachment } from "../src/lib/alo-attachments";
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  aloKey,
  cloudEnabled,
  getMiraGrants,
  listAlo,
  localDay,
  mergeRemote,
  putAlo,
  readRecords,
  removeAlo,
  resolveConflict,
  safeLink,
  saveMiraGrants,
  searchAlo,
  setAloOwner,
  setCloudEnabled,
  type AloRecord,
  type CloudRecord,
} from "../src/lib/alo-store";
import {
  loadSessions,
  saveSessions,
  loadPersona,
  savePersona,
  loadFavPrompts,
  toggleFavPrompt,
} from "../src/lib/super-ai-tools";
import { getDraft, saveDraft } from "../src/lib/chat-extras";
import { addWorkoutNote, getWorkoutNotes } from "../src/lib/extra-features";
function withStorage(fn: (values: Map<string, string>) => void) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (k: string) => values.get(k) ?? null,
        setItem: (k: string, v: string) => values.set(k, v),
        removeItem: (k: string) => values.delete(k),
      },
      dispatchEvent: () => true,
    },
  });
  try {
    setAloOwner("account-a");
    fn(values);
  } finally {
    setAloOwner(null);
    if (descriptor) Object.defineProperty(globalThis, "window", descriptor);
    else Reflect.deleteProperty(globalThis, "window");
  }
}
const local: AloRecord = {
  id: "draft:room:one",
  kind: "draft",
  body: { text: "local" },
  revision: 2,
  updatedAt: "2026-10-19T10:00:00Z",
  dirty: true,
  deleted: false,
};
const remote: CloudRecord = {
  id: local.id,
  kind: "draft",
  body: { text: "remote" },
  revision: 3,
  updated_at: "2026-10-19T11:00:00Z",
  deleted: false,
};
test("Mira and cloud access default off independently for each account; old combined consent is ignored", () =>
  withStorage((values) => {
    values.set("alo-mira-context-enabled", "true");
    assert.deepEqual(getMiraGrants(), { training: false, rooms: [] });
    assert.equal(cloudEnabled(), false);
    saveMiraGrants({ training: false, rooms: ["room-a"] });
    setCloudEnabled(true);
    assert.deepEqual(getMiraGrants(), { training: false, rooms: ["room-a"] });
    setAloOwner("account-b");
    assert.deepEqual(getMiraGrants(), { training: false, rooms: [] });
    assert.equal(cloudEnabled(), false);
  }));
test("Alo records, Mira history, persona, favorites, notes and drafts cannot cross accounts", () =>
  withStorage(() => {
    putAlo("capture", { title: "Private A" }, "capture-a");
    saveSessions([
      {
        id: "a",
        title: "Private Mira",
        updatedAt: "2026-10-19",
        messages: [{ role: "user", content: "secret-a" }],
      },
    ]);
    savePersona("writer");
    toggleFavPrompt("my private prompt");
    addWorkoutNote("Private workout note");
    saveDraft("account-a", "room", "one", "my draft");
    setAloOwner("account-b");
    assert.equal(listAlo().length, 0);
    assert.deepEqual(loadSessions(), []);
    assert.equal(loadPersona(), "general");
    assert.deepEqual(loadFavPrompts(), []);
    assert.deepEqual(getWorkoutNotes(), []);
    assert.equal(getDraft("account-b", "room", "one"), "");
    setAloOwner("account-a");
    assert.equal(loadSessions()[0].messages[0].content, "secret-a");
    assert.equal(loadPersona(), "writer");
    assert.equal(getWorkoutNotes()[0].text, "Private workout note");
  }));
test("saving one Mira session never implicitly removes a remotely downloaded session", () =>
  withStorage(() => {
    const make = (id: string) => ({
      id,
      title: id,
      updatedAt: "2026-10-19",
      messages: [{ role: "user" as const, content: id }],
    });
    saveSessions([make("a"), make("b")]);
    saveSessions([make("a")]);
    assert.equal(loadSessions().length, 2);
  }));
test("concurrent edits retain local text and expose the other version instead of overwriting", () => {
  const merged = mergeRemote([local], [remote]);
  assert.equal(merged[0].body.text, "local");
  assert.equal(merged[0].dirty, true);
  assert.equal(merged[0].conflict?.body.text, "remote");
  assert.equal(merged[0].revision, 2);
});
test("unsent edits against the same cloud revision remain dirty without a false conflict", () => {
  const merged = mergeRemote([local], [{ ...remote, revision: 2 }]);
  assert.deepEqual(merged, [local]);
});
test("remote tombstones remove clean content and expose a deletion conflict for offline edits", () => {
  const deleted = { ...remote, deleted: true, body: {} };
  assert.equal(mergeRemote([{ ...local, dirty: false }], [deleted])[0].deleted, true);
  const conflict = mergeRemote([local], [deleted])[0];
  assert.equal(conflict.deleted, false);
  assert.equal(conflict.conflict?.deleted, true);
});
test("explicit conflict resolution can choose local or remote without silent content loss", () =>
  withStorage((values) => {
    values.set(aloKey("account-a"), JSON.stringify(mergeRemote([local], [remote])));
    resolveConflict(local.id, "local");
    assert.equal(readRecords()[0].revision, 3);
    assert.equal(readRecords()[0].dirty, true);
    assert.equal(readRecords()[0].body.text, "local");
    values.set(aloKey("account-a"), JSON.stringify(mergeRemote([local], [remote])));
    resolveConflict(local.id, "remote");
    assert.equal(readRecords()[0].dirty, false);
    assert.equal(readRecords()[0].body.text, "remote");
  }));
test("deletion removes body content while preserving a dirty tombstone for other devices", () =>
  withStorage(() => {
    putAlo("capture", { title: "private", attachment: { data: "private bytes" } }, "c");
    removeAlo("c");
    assert.deepEqual(listAlo(), []);
    assert.deepEqual(readRecords()[0].body, {});
    assert.equal(readRecords()[0].dirty, true);
    assert.equal(readRecords()[0].deleted, true);
  }));
test("legacy drafts cannot resurrect after a cloud deletion tombstone", () =>
  withStorage((values) => {
    values.set("np-chat-drafts:account-a", JSON.stringify({ "room:one": "old draft" }));
    saveDraft("account-a", "room", "one", "new draft");
    removeAlo("draft:room:one");
    assert.equal(getDraft("account-a", "room", "one"), "");
  }));
test("local storage quota and malformed stores surface errors rather than claiming success", () =>
  withStorage((values) => {
    values.set(aloKey("account-a"), "invalid json");
    assert.throws(() => putAlo("capture", { text: "keep me" }, "c"));
    assert.equal(values.get(aloKey("account-a")), "invalid json");
    values.delete(aloKey("account-a"));
    const old = window.localStorage.setItem;
    window.localStorage.setItem = () => {
      throw new Error("quota");
    };
    assert.throws(() => putAlo("capture", { text: "keep me" }, "c"), /quota/);
    window.localStorage.setItem = old;
  }));
test("global search matches all query words across titles and content without inventing records", () => {
  const rows = [
    { title: "Mira Wochenplan", text: "Schultern ruhig", source: "Mira" },
    { title: "Nexus", text: "Abendessen", source: "Nexus" },
  ];
  assert.deepEqual(searchAlo(rows, "PLAN schultern"), [rows[0]]);
  assert.deepEqual(searchAlo(rows, ""), []);
  assert.deepEqual(searchAlo(rows, "Nicht vorhanden"), []);
});
test("links reject active schemes and local dates follow the device calendar", () => {
  assert.equal(safeLink("javascript:alert(1)"), null);
  assert.equal(safeLink("data:text/html,evil"), null);
  assert.equal(safeLink("https://example.org"), "https://example.org/");
  assert.equal(localDay(new Date(2026, 9, 19, 0, 1)), "2026-10-19");
});
test("workspace schema is account-scoped, uses revision compare-and-swap and guards RPC execution", () => {
  const sql = readFileSync(
    new URL("../supabase/migrations/20261019210000_alo_workspace.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /PRIMARY KEY \(user_id, id\)/);
  assert.match(sql, /revision = p_revision/);
  assert.match(sql, /user_id = auth.uid\(\)/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public.alo_sync_record/);
  assert.match(sql, /ON CONFLICT DO NOTHING/);
  const context = readFileSync(new URL("../src/lib/ai-context.ts", import.meta.url), "utf8");
  assert.match(context, /grants.training\s+\? await buildTrainingContext/);
  assert.match(context, /grants.rooms.includes\(room.id\)/);
  assert.doesNotMatch(context, /loadChatStore/);
});

test("shared attachment payloads reject executable links, active documents and malformed data", () => {
  assert.equal(readAttachment({ name: "x", type: "image/png", data: "javascript:alert(1)" }), null);
  assert.equal(
    readAttachment({
      name: "x.svg",
      type: "image/svg+xml",
      data: "data:image/svg+xml;base64,PHN2Zz4=",
    }),
    null,
  );
  assert.equal(readAttachment({ name: "audio", type: 123, data: "anything" }), null);
  assert.deepEqual(
    readAttachment({
      name: "photo.png",
      type: "image/png",
      data: "data:image/png;base64,aGVsbG8=",
    }),
    { name: "photo.png", type: "image/png", data: "data:image/png;base64,aGVsbG8=" },
  );
});

test("malformed record arrays are rejected instead of overwriting unknown data", () =>
  withStorage((values) => {
    values.set(aloKey("account-a"), JSON.stringify([{}]));
    assert.throws(() => readRecords(), /beschädigt/);
  }));
test("Mira deletion and tab grants include regression guards for review findings", () => {
  const ai = readFileSync(new URL("../src/routes/_authenticated/ai.tsx", import.meta.url), "utf8");
  assert.match(ai, /generation !== generationRef.current/);
  assert.match(
    ai,
    /removeAlo\(`mira:\$\{activeId\}`\);\s+setSessions\(loadSessions\(\)\);\s+setActiveId\(newSessionId\(\)\)/,
  );
  const controls = readFileSync(
    new URL("../src/components/alo/MiraContextControls.tsx", import.meta.url),
    "utf8",
  );
  assert.match(controls, /addEventListener\(ALO_REMOTE_EVENT, refresh\)/);
  assert.match(controls, /\.\.\.getMiraGrants\(userId\)/);
});
