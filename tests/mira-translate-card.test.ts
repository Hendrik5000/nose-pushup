import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MiraVisualAnswerCard } from "../src/components/mira/MiraVisualAnswerCard.tsx";
import { parseAiResponse } from "../src/lib/ai-plan.ts";
import { validateMiraVisualAnswer } from "../src/lib/mira-visual-answer.ts";

const pair = {
  type: "translatePair",
  schemaVersion: 1,
  sourceLanguage: "Deutsch",
  targetLanguage: "Englisch",
  original: "Guten Morgen, hast du schon trainiert?",
  translation: "Good morning, have you trained yet?",
};

test("validiert eine korrekte Übersetzungskarte", () => {
  const parsed = validateMiraVisualAnswer(pair);
  assert.ok(parsed);
  assert.equal(parsed.type, "translatePair");
});

test("verwirft invalide Übersetzungskarten", () => {
  assert.equal(validateMiraVisualAnswer({ ...pair, schemaVersion: 2 }), null);
  assert.equal(validateMiraVisualAnswer({ ...pair, extra: true }), null);
  assert.equal(validateMiraVisualAnswer({ ...pair, sourceLanguage: "" }), null);
  assert.equal(validateMiraVisualAnswer({ ...pair, translation: "https://example.com" }), null);
  assert.equal(
    validateMiraVisualAnswer({ ...pair, original: "x".repeat(1201) }),
    null,
  );
});

test("akzeptiert mehrzeilige Texte in der Übersetzungskarte", () => {
  const parsed = validateMiraVisualAnswer({ ...pair, original: "Zeile eins\nZeile zwei" });
  assert.ok(parsed);
});

test("parseAiResponse liest translatePair aus vollständiger JSON-Antwort", () => {
  const raw = JSON.stringify({ reply: "Hier ist die Übersetzung.", visual: pair });
  const parsed = parseAiResponse(raw);
  assert.equal(parsed.reply, "Hier ist die Übersetzung.");
  assert.ok(parsed.visual);
  assert.equal(parsed.visual.type, "translatePair");
});

test("die feste Karte rendert Original und Übersetzung", () => {
  const html = renderToStaticMarkup(createElement(MiraVisualAnswerCard, { visual: pair }));
  assert.match(html, /Original/);
  assert.match(html, /Guten Morgen/);
  assert.match(html, /Good morning/);
});

test("die feste Karte rendert ungültige Daten nicht", () => {
  const html = renderToStaticMarkup(
    createElement(MiraVisualAnswerCard, { visual: { ...pair, schemaVersion: 9 } }),
  );
  assert.equal(html, "");
});
