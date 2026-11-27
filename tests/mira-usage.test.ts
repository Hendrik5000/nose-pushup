import assert from "node:assert/strict";
import test from "node:test";
import {
  formatMiraUsageLine,
  readMiraUsage,
  recordMiraUsage,
} from "../src/lib/mira-usage.ts";

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

test("zaehlt erfolgreiche Anfragen pro Anbieter und Modell", () => {
  withWindow(() => {
    recordMiraUsage({ userId: "u1", provider: "Google", model: "gemini-4-hydrogen", ok: true });
    recordMiraUsage({ userId: "u1", provider: "Google", model: "gemini-4-hydrogen", ok: true });
    recordMiraUsage({ userId: "u1", provider: "Google", model: "gemini-3.1-flash-lite", ok: true });
    const rows = readMiraUsage("u1");
    assert.equal(rows.length, 2);
    assert.equal(rows[0].count, 2);
    assert.equal(rows[0].errors, 0);
  });
});

test("trennt Konten und faellt auf ohne Anmeldung zurueck", () => {
  withWindow(() => {
    recordMiraUsage({ userId: "u1", provider: "Google", model: "m", ok: true });
    recordMiraUsage({ userId: "u2", provider: "OpenRouter", model: "m", ok: true });
    assert.equal(readMiraUsage("u1").length, 1);
    assert.equal(readMiraUsage("u2").length, 1);
    assert.equal(readMiraUsage("u3").length, 0);
  });
});

test("ignoriert ungueltige Anbieterangaben ehrlich", () => {
  withWindow(() => {
    recordMiraUsage({ userId: "u1", provider: "", model: "m", ok: true });
    recordMiraUsage({ userId: "u1", provider: "<script>", model: "m", ok: true });
    recordMiraUsage({ userId: "u1", provider: 42, model: "m", ok: true });
    assert.equal(readMiraUsage("u1").length, 0);
  });
});

test("zaehlt Fehler getrennt", () => {
  withWindow(() => {
    recordMiraUsage({ userId: "u1", provider: "Google", model: "m", ok: true });
    recordMiraUsage({ userId: "u1", provider: "Google", model: "m", ok: false });
    const rows = readMiraUsage("u1");
    assert.equal(rows[0].count, 2);
    assert.equal(rows[0].errors, 1);
    assert.match(formatMiraUsageLine(rows[0]), /1 Fehler/);
  });
});

test("formatiert die Zusammenfassung auf Deutsch", () => {
  withWindow(() => {
    recordMiraUsage({ userId: "u1", provider: "Google", model: "m", ok: true });
    const line = formatMiraUsageLine(readMiraUsage("u1")[0]);
    assert.match(line, /Google · m: 1 Anfragen, zuletzt \d{4}-\d{2}-\d{2}/);
  });
});
