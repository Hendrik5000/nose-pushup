import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(
  new URL("../src/components/mira/SuperAiPage.tsx", import.meta.url),
  "utf8",
);
const voiceDialog = readFileSync(
  new URL("../src/components/mira/MiraVoiceConversationDialog.tsx", import.meta.url),
  "utf8",
);
const chatCss = readFileSync(new URL("../src/mira-chat-design.css", import.meta.url), "utf8");

test("Mira's reference chat keeps its formatted, accessible historical answer presentation", () => {
  const stageStart = page.indexOf('className="sport-chat-stage');
  const bottomRowStart = page.indexOf('className="mira-chat-bottom-row"', stageStart);
  assert.ok(stageStart >= 0 && bottomRowStart > stageStart);
  const stage = page.slice(stageStart, bottomRowStart);
  assert.match(stage, /<MiraProgressiveAnswer/);
  assert.match(stage, /isFreshAssistantReply\(m, i\)/);
  assert.match(stage, /<MiraInteractiveCard/);
  assert.match(page, /<MiraSources userId=\{userId\} \/>/);
  assert.match(page, /Gesprächsoptionen & Datenschutz/);
  assert.match(stage, /<MiraAnswerActions[\s\S]*?meta=\{m\.meta\}/);
  assert.match(page, /className=\{`sport-chat-composer/);
});

test("restored chat motion respects reduced-motion preferences and preserves modern voice controls", () => {
  assert.match(chatCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(chatCss, /\.alo-mira-generating-dot,[\s\S]*?animation: none/);
  assert.match(page, /MiraVoiceConversationDialog/);
  assert.match(voiceDialog, /Mira unterbrechen und weiter zuhören/);
  assert.match(page, /sendTranscript: \(transcript\) =>[\s\S]*?submitRef\.current\(transcript/);
});

test("session titles use the short German topic title rather than truncating mid-sentence", () => {
  assert.match(page, /createMiraChatTitle\(s\.title\)/);
  assert.match(
    page,
    /createMiraChatTitle\(messages\.find\(\(m\) => m\.role === "user"\)\?\.content \?\? ""\)/,
  );
});
