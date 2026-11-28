import assert from "node:assert/strict";
import test from "node:test";
import {
  MIRA_ACTION_INSTRUCTIONS,
  saveMiraActionEntry,
  validateMiraActionCard,
  type MiraActionCard,
} from "../src/lib/mira-action-cards.ts";
import { parseAiResponse } from "../src/lib/ai-plan.ts";

const validTask: MiraActionCard = {
  type: "createAloEntry",
  schemaVersion: 1,
  kind: "task",
  title: "Wasser trinken",
  text: "Zwei Liter ueber den Tag verteilt trinken.",
};

function withWindow(run: () => void) {
  const store = new Map<string, string>();
  const fakeWindow = {
    localStorage: {
      getItem: (key: string) => (store.has(key) ? (store.get(key) as string) : null),
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    },
    dispatchEvent: () => undefined,
  };
  const original = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window = fakeWindow;
  try {
    run();
  } finally {
    (globalThis as { window?: unknown }).window = original;
  }
}

test("validiert eine korrekte Aufgabenkarte", () => {
  const parsed = validateMiraActionCard(validTask);
  assert.ok(parsed);
  assert.equal(parsed.kind, "task");
  assert.equal(parsed.due, undefined);
});

test("verwirft invalide Karten", () => {
  assert.equal(validateMiraActionCard(null), null);
  assert.equal(validateMiraActionCard({ ...validTask, schemaVersion: 2 }), null);
  assert.equal(validateMiraActionCard({ ...validTask, kind: "alarm" }), null);
  assert.equal(validateMiraActionCard({ ...validTask, title: "" }), null);
  assert.equal(validateMiraActionCard({ ...validTask, text: "https://example.com" }), null);
  assert.equal(validateMiraActionCard({ ...validTask, due: "31.12.2026" }), null);
  assert.equal(validateMiraActionCard({ ...validTask, unexpected: true }), null);
});

test("akzeptiert Notiz mit gueltigem Datum", () => {
  const parsed = validateMiraActionCard({
    ...validTask,
    kind: "note",
    due: "2026-12-01",
  });
  assert.ok(parsed);
  assert.equal(parsed.due, "2026-12-01");
});

test("lehnt unplausibles Datum ab", () => {
  assert.equal(validateMiraActionCard({ ...validTask, due: "2026-02-30" }), null);
});

test("parseAiResponse liest action aus vollstaendiger JSON-Antwort", () => {
  const raw = JSON.stringify({
    reply: "Ich habe eine Aufgabe vorbereitet.",
    action: validTask,
  });
  const parsed = parseAiResponse(raw);
  assert.equal(parsed.reply, "Ich habe eine Aufgabe vorbereitet.");
  assert.ok(parsed.action);
  assert.equal(parsed.action.kind, "task");
});

test("parseAiResponse laesst normalen Text unveraendert", () => {
  const parsed = parseAiResponse("Einfache Antwort ohne JSON.");
  assert.equal(parsed.reply, "Einfache Antwort ohne JSON.");
  assert.equal(parsed.action, undefined);
});

test("saveMiraActionEntry legt eine Aufgabe im Alo-Speicher ab", () => {
  withWindow(() => {
    const record = saveMiraActionEntry(validTask, "user-1");
    assert.equal(record.kind, "task");
    assert.equal(record.body.done, false);
    assert.equal(record.body.title, validTask.title);
  });
});

test("saveMiraActionEntry legt eine Notiz als Schnellablage ab", () => {
  withWindow(() => {
    const record = saveMiraActionEntry({ ...validTask, kind: "note" }, "user-1");
    assert.equal(record.kind, "capture");
    assert.equal(record.body.source, "Mira");
  });
});

test("saveMiraActionEntry ohne Anmeldung wirft ehrlich", () => {
  withWindow(() => {
    assert.throws(() => saveMiraActionEntry(validTask, ""));
  });
});

test("Anweisungen existieren und nennen die feste Karte", () => {
  assert.match(MIRA_ACTION_INSTRUCTIONS, /createAloEntry/);
});
