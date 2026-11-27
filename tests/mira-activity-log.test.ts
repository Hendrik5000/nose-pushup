import assert from "node:assert/strict";
import test from "node:test";
import {
  formatMiraActivityLine,
  readMiraActivity,
  recordMiraActivity,
} from "../src/lib/mira-activity-log.ts";

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

test("zeichnet gueltige Aktivitaeten auf und liest sie zurueck", () => {
  withWindow(() => {
    recordMiraActivity({ userId: "u1", kind: "chat", label: "Google · gemini-4-hydrogen" });
    recordMiraActivity({ userId: "u1", kind: "entry", label: "Aufgabe: Wasser trinken" });
    const rows = readMiraActivity("u1");
    assert.equal(rows.length, 2);
    assert.equal(rows[0].kind, "entry");
  });
});

test("trennt Konten strikt", () => {
  withWindow(() => {
    recordMiraActivity({ userId: "u1", kind: "chat", label: "Anfrage A" });
    recordMiraActivity({ userId: "u2", kind: "chat", label: "Anfrage B" });
    assert.equal(readMiraActivity("u1").length, 1);
    assert.equal(readMiraActivity("u2").length, 1);
    assert.equal(readMiraActivity("u3").length, 0);
  });
});

test("verwirft ungueltige Eintraege ehrlich", () => {
  withWindow(() => {
    recordMiraActivity({ userId: "u1", kind: "browser", label: "" });
    recordMiraActivity({ userId: "u1", kind: "browser", label: "<script>" });
    recordMiraActivity({ userId: "u1", kind: "hacking" as never, label: "x" });
    recordMiraActivity({ userId: "u1", kind: "chat", label: 42 });
    assert.equal(readMiraActivity("u1").length, 0);
  });
});

test("begrenzt das Protokoll auf 200 Eintraege", () => {
  withWindow(() => {
    for (let index = 0; index < 210; index += 1) {
      recordMiraActivity({
        userId: "u1",
        kind: "chat",
        label: "Anfrage " + index,
        at: new Date(2026, 10, 20, 12, 0, index).toISOString(),
      });
    }
    assert.equal(readMiraActivity("u1").length, 100);
  });
});

test("formatiert die Protokollzeile auf Deutsch", () => {
  withWindow(() => {
    recordMiraActivity({ userId: "u1", kind: "entry", label: "Notiz: Einkaufsliste" });
    const line = formatMiraActivityLine(readMiraActivity("u1")[0]);
    assert.match(line, /^Gespeichert: Notiz: Einkaufsliste · /);
  });
});
