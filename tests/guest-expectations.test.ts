import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getFatigueAdvice, getFatigueLevel } from "../src/lib/calisthenics.ts";

const read = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");

test("Calisthenics does not infer a ready state from missing check-ins and workout history", () => {
  assert.equal(getFatigueLevel(0, null), "unknown");
  const advice = getFatigueAdvice(getFatigueLevel(0, null));
  assert.equal(advice.title, "Noch keine Daten");
  assert.match(
    advice.message,
    /Für die letzten 7 Tage liegen keine Trainings- oder Check-in-Daten vor/,
  );
  assert.doesNotMatch(advice.message, /Voller Einsatz möglich|Bestform/);
});

test("an untouched Calisthenics check-in cannot save default or unreported health values", () => {
  const checkin = read("components/CaliCheckin.tsx");
  assert.match(checkin, /existing\?\.energy \?\? null/);
  assert.match(checkin, /existing\?\.soreness \?\? null/);
  assert.match(checkin, /if \(energy === null \|\| soreness === null\) return/);
  assert.match(checkin, /disabled=\{energy === null \|\| soreness === null\}/);
  assert.match(checkin, /Noch nicht angegeben/);
  const page = read("routes/_authenticated/calisthenics.tsx");
  assert.match(page, /: null;/);
  assert.doesNotMatch(page, /: 1;\s*\/\/.*soreness/i);
});

test("Mira exposes technical model identifiers only through secondary details", () => {
  const ai = read("routes/_authenticated/ai.tsx");
  assert.match(
    ai,
    /<span>Mira<\/span>[\s\S]*?<summary className="cursor-pointer">Technische Details<\/summary>[\s\S]*?activeProvider\.model/,
  );
  assert.match(
    ai,
    /<details className="text-\[10px\] text-muted-foreground">[\s\S]*?m\.meta\.task[\s\S]*?m\.meta\.provider[\s\S]*?m\.meta\.model[\s\S]*?<\/details>/,
  );
  assert.doesNotMatch(ai, /<span>\{activeProvider\?\.model/);
});

test("Nexus explicitly distinguishes device-only rooms from an actually connected chat", () => {
  const chat = read("components/chat/LocalChatShell.tsx");
  assert.match(
    chat,
    /mode === "local"\s*\? "Nur auf diesem Gerät gespeichert\. Kein Versand an andere Geräte\."\s*:\s*"Mit Nexus Chat verbunden\."/,
  );
  assert.match(chat, /mode === "local" \? "Lokale Räume" : "Räume"/);
});
