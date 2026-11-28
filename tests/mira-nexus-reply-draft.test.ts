import assert from "node:assert/strict";
import test from "node:test";
import {
  MIRA_REPLY_DRAFT_SYSTEM,
  buildNexusReplyDraftHistory,
  buildNexusReplyDraftPrompt,
  cleanReplyDraftText,
  type NexusDraftMessage,
} from "../src/lib/mira-nexus-reply-draft.ts";

const transcript: NexusDraftMessage[] = [
  { author: "Anna", own: false, content: "Wollen wir morgen trainieren?" },
  { author: "Du", own: true, content: "Klar, nach der Arbeit." },
  { author: "Anna", own: false, content: "Perfekt, 18 Uhr?" },
];

test("baut den Verlauf als Zeilen und verlangt fremde Nachrichten", () => {
  const history = buildNexusReplyDraftHistory(transcript);
  assert.ok(history);
  assert.match(history, /Anna: Wollen wir morgen trainieren\?/);
  const ownOnly = buildNexusReplyDraftHistory([
    { author: "Du", own: true, content: "Nur ich" },
  ]);
  assert.equal(ownOnly, null);
});

test("bereinigt Steuerzeichen und begrenzt Umfang", () => {
  const many: NexusDraftMessage[] = [];
  for (let index = 0; index < 40; index += 1) {
    many.push({ author: "Anna", own: false, content: "Nachricht " + index });
  }
  const history = buildNexusReplyDraftHistory(many);
  assert.ok(history);
  assert.equal(history.split("\n").length, 30);
  const dirty = buildNexusReplyDraftHistory([
    { author: "Anna", own: false, content: "Zeile\u0007mit Steuerzeichen" },
  ]);
  assert.ok(dirty);
  assert.doesNotMatch(dirty, /[\u0007]/);
});

test("der Prompt nennt Raum, Verlauf und Regel", () => {
  const prompt = buildNexusReplyDraftPrompt("Fitness", "Hendrik", "Anna: Hi");
  assert.match(prompt, /Chat-Raum "Fitness"/);
  assert.match(prompt, /Anna: Hi/);
  assert.match(prompt, /ausschließlich mit dem Entwurfstext/);
});

test("reinigt Miras Antwort: Zäune, Quotes, Verweigerung", () => {
  assert.equal(cleanReplyDraftText("```text\nHallo!\n```"), "Hallo!");
  assert.equal(cleanReplyDraftText('"Gute Idee!"'), "Gute Idee!");
  assert.equal(cleanReplyDraftText("KEIN_ENTWURF"), null);
  assert.equal(cleanReplyDraftText(""), null);
  assert.equal(cleanReplyDraftText("x".repeat(2001)), null);
});

test("die Systemanweisung verbietet automatisches Senden", () => {
  assert.match(MIRA_REPLY_DRAFT_SYSTEM, /niemals automatisch gesendet/);
  assert.match(MIRA_REPLY_DRAFT_SYSTEM, /KEIN_ENTWURF/);
});
