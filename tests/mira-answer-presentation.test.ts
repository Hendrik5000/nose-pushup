import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
const page = read("components/mira/SuperAiPage.tsx");
const chatDesign = read("mira-chat-design.css");
const answerActions = read("components/mira/MiraAnswerActions.tsx");

test("assistant answers flow without a frame or Mira mark in both chat layouts", () => {
  const classicStart = page.indexOf('className="alo-classic-mira-messages');
  const classicMessagesStart = page.indexOf("{displayMessages.map((m, i) => (", classicStart);
  const classicEnd = page.indexOf(
    "{loading && <MiraGeneratingIndicator label={marketplaceProgress ?? undefined} />}",
    classicMessagesStart,
  );
  const classicWelcome = page.slice(classicStart, classicMessagesStart);
  const classic = page.slice(classicMessagesStart, classicEnd);
  assert.ok(
    classicStart >= 0 && classicMessagesStart > classicStart && classicEnd > classicMessagesStart,
  );
  assert.match(classicWelcome, /mira-chat-welcome-mark[\s\S]*?<MiraSpark \/>/);
  assert.doesNotMatch(classic, /mira-chat-answer-mark|mira-chat-answer-bubble|<MiraSpark/);
  assert.match(
    classic,
    /m\.role === "user"\s*\?\s*"max-w-\[88%\] rounded-2xl rounded-br-md bg-primary px-3\.5 py-2\.5 text-sm text-primary-foreground shadow-sm"\s*:\s*"max-w-\[92%\] text-sm leading-relaxed"/,
  );
  assert.doesNotMatch(classic, /rounded-bl-md border border-border\/80 bg-background\/70/);

  const stageStart = page.indexOf('className="sport-chat-stage');
  const welcomeStart = page.indexOf('className="mira-chat-welcome', stageStart);
  const messagesStart = page.indexOf("{displayMessages.map((m, i) => (", welcomeStart);
  const bottomRowStart = page.indexOf('className="mira-chat-bottom-row"', messagesStart);
  const welcome = page.slice(welcomeStart, messagesStart);
  const replies = page.slice(messagesStart, bottomRowStart);
  assert.ok(stageStart >= 0 && welcomeStart > stageStart && messagesStart > welcomeStart);
  assert.match(welcome, /mira-chat-welcome-mark[\s\S]*?<MiraSpark \/>/);
  assert.doesNotMatch(replies, /mira-chat-answer-mark|mira-chat-answer-bubble|<MiraSpark/);
  assert.doesNotMatch(chatDesign, /mira-chat-answer-(?:mark|bubble)/);

  const articleStart = replies.indexOf("<article");
  const articleEnd = replies.indexOf(">", articleStart);
  const article = replies.slice(articleStart, articleEnd);
  assert.match(
    article,
    /m\.role === "user"\s*\?\s*"sport-ai-bubble[\s\S]*?mira-chat-user-bubble rounded-br-md bg-primary text-primary-foreground"\s*:\s*"max-w-\[90%\] min-w-0 text-sm leading-relaxed"/,
  );
  assert.match(replies, /<MiraProgressiveAnswer[\s\S]*?<MiraAnswerActions/);
});

test("unframed answers keep the named, keyboard-accessible response actions", () => {
  assert.match(answerActions, /role="group"\s+aria-label="Aktionen für Miras Antwort"/);
  for (const label of [
    "Technische Details",
    "Miras Antwort vorlesen",
    "Miras Antwort stoppen",
    "Kopieren",
    "Merken",
  ]) {
    assert.ok(answerActions.includes(label), `missing accessible action label: ${label}`);
  }
  assert.match(answerActions, /iconOnly/);
});
