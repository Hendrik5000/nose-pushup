import assert from "node:assert/strict";
import test from "node:test";
import { addMiraMemoryNote, loadMiraMemoryNotes } from "../src/lib/mira-memory.ts";

function installMemoryStorage() {
  const values = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, String(value)),
    removeItem: (key: string) => values.delete(key),
  };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage },
  });
}

test("Mira memory rejects duplicates after trim, whitespace collapse, and case folding", () => {
  installMemoryStorage();
  const first = addMiraMemoryNote("  Ich   mag Jazz  ", "dedup-user");
  assert.ok(first);
  assert.equal(first.text, "Ich mag Jazz");

  assert.equal(addMiraMemoryNote("ich mag   jazz", "dedup-user"), null);
  const notes = loadMiraMemoryNotes("dedup-user");
  assert.equal(notes.length, 1);
  assert.equal(notes[0]?.id, first.id);
  assert.equal(notes[0]?.text, "Ich mag Jazz");
});

test("Mira memory duplicate checks remain scoped per user and preserve insertion order", () => {
  installMemoryStorage();
  const first = addMiraMemoryNote("Ich wohne in Berlin", "user-a");
  const second = addMiraMemoryNote("Ich wohne in Berlin", "user-b");
  assert.ok(first);
  assert.ok(second);
  assert.notEqual(first.id, second.id);

  const later = addMiraMemoryNote("Ich mag Jazz", "user-a");
  assert.ok(later);
  assert.deepEqual(
    loadMiraMemoryNotes("user-a").map((note) => note.text),
    ["Ich mag Jazz", "Ich wohne in Berlin"],
  );
});

test("Mira memory controls remain labelled, touch-sized, and scoped after account changes", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(
    new URL("../src/components/MiraMemoryPanel.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /htmlFor=\{noteInputId\}/);
  assert.match(source, /min-h-11 min-w-0 flex-1/);
  assert.match(source, /focus-visible:ring-2/);
  assert.ok(source.includes("aria-label={`Notiz löschen: ${n.text}`}"));
  assert.match(source, /stateUserId === userId/);
  assert.match(source, /currentUserReady \? notes : \[\]/);
});
