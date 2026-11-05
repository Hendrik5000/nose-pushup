import assert from "node:assert/strict";
import test from "node:test";
import { createMiraChatTitle } from "../src/lib/mira-chat-title.ts";

test("Mira titles keep the topic, drop polite prompt framing, and stop at whole words", () => {
  assert.equal(
    createMiraChatTitle(
      "Mira, kannst du mir bitte erklären, wie ich meinen Trainingsplan sinnvoll anpasse? Danach noch etwas.",
    ),
    "Trainingsplan sinnvoll anpasse",
  );
  assert.equal(
    createMiraChatTitle("Wie kann ich eine Wochenroutine für Krafttraining planen?"),
    "Wochenroutine Krafttraining",
  );
});

test("Mira titles normalize spacing and punctuation while preserving meaningful names", () => {
  assert.equal(createMiraChatTitle("  Nexus   Chat: Fotos & Nachrichten!!!  "), "Nexus Chat Fotos");
  assert.equal(createMiraChatTitle("Mira"), "Mira");
});

test("Mira title length stays short without a mid-word truncation or dangling conjunction", () => {
  const title = createMiraChatTitle(
    "Erstelle einen ausführlichen Vergleich der Trainingsübersicht, Gym-Partnerschaft und Gesundheitsdaten für die nächste Woche.",
  );
  assert.ok(title.length <= 32, `${title} should be at most 32 characters`);
  assert.doesNotMatch(title, /\b(?:und|oder|für|mit|der|die|das|den|dem)$/iu);
  assert.ok(!title.endsWith("…"));
});

test("empty, punctuation-only, and request-only input falls back to a useful new-chat label", () => {
  assert.equal(createMiraChatTitle("   "), "Neuer Chat");
  assert.equal(createMiraChatTitle("!!! ???"), "Neuer Chat");
  assert.equal(createMiraChatTitle("Bitte kannst du mir helfen"), "Neuer Chat");
});
