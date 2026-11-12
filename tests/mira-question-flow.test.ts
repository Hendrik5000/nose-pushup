import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
const page = read("components/mira/SuperAiPage.tsx");
const chatDesign = read("mira-chat-design.css");

function sliceBetween(source: string, start: string, end: string, from = 0) {
  const startIndex = source.indexOf(start, from);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.ok(startIndex >= 0 && endIndex > startIndex, `missing section: ${start} … ${end}`);
  return source.slice(startIndex, endIndex);
}

test("first pending question hides the empty greeting in both Mira chat layouts", () => {
  const classic = sliceBetween(
    page,
    'className="alo-classic-mira-messages',
    "{displayMessages.map((m, i) => (",
  );
  const sport = sliceBetween(
    page,
    'className="sport-chat-stage',
    "{displayMessages.map((m, i) => (",
  );

  assert.match(classic, /messages\.length === 0\s*&&\s*!activePendingUserMessage/);
  assert.match(sport, /messages\.length === 0\s*&&\s*!activePendingUserMessage/);
  assert.match(page, /setPendingUserMessage\(\{ sessionId: activeId, message: userMessage \}\)/);
});

test("pending user questions use the right-aligned user bubble and precede Mira's status", () => {
  const classic = sliceBetween(page, 'className="alo-classic-mira-messages', "{error && (");
  const sport = sliceBetween(
    page,
    'className="sport-chat-stage',
    'className="mira-chat-bottom-row"',
  );

  for (const view of [classic, sport]) {
    const questionIndex = view.indexOf("data-mira-pending-question");
    const statusIndex = view.indexOf(
      "{loading && <MiraGeneratingIndicator label={marketplaceProgress ?? undefined} />}",
    );
    assert.ok(questionIndex >= 0 && statusIndex > questionIndex);
    assert.match(
      view,
      /<p className="whitespace-pre-wrap">\{activePendingUserMessage\.content\}<\/p>/,
    );
  }
  assert.match(
    classic,
    /data-mira-pending-question[\s\S]*?className="flex justify-end"|className="flex justify-end"[\s\S]*?data-mira-pending-question/,
  );
  assert.match(sport, /data-mira-pending-question[\s\S]*?justify-end/);
  assert.match(page, /role="status"\s+aria-live="polite"\s+aria-atomic="true"/);
});

test("the pending question is replaced by the saved question and real answer, and errors clear it", () => {
  const sendStart = page.indexOf("const res = await send({");
  const sendEnd = page.indexOf("} catch (e) {", sendStart);
  const success = page.slice(sendStart, sendEnd);
  assert.match(success, /setMessages\(\[[\s\S]*?\.\.\.nextMsgs,[\s\S]*?role: "assistant"/);
  assert.match(success, /setPendingUserMessage\(null\)/);
  assert.ok(success.indexOf('role: "assistant"') < success.indexOf("setPendingUserMessage(null)"));

  const failure = sliceBetween(page, "} catch (e) {", "} finally {");
  assert.match(failure, /setError\(msg\);[\s\S]*?setPendingUserMessage\(null\)/);
  assert.match(failure, /Keep the draft and local attachments/);
  assert.match(page, /setPendingUserMessage\(null\);\s*setReplyAnimation\(null\);/);
});

test("each new send scrolls to its question, while the answer keeps the existing bottom-follow behavior", () => {
  const scrollEffect = sliceBetween(
    page,
    "const container = scrollRef.current;",
    "}, [messages, loading, activeId, activePendingUserMessage]);",
  );
  assert.match(scrollEffect, /activePendingUserMessage \? pendingQuestionRef\.current : null/);
  assert.match(scrollEffect, /question\.getBoundingClientRect\(\)\.top/);
  assert.match(scrollEffect, /container\.scrollTo\([\s\S]*?container\.scrollTop \+ questionOffset/);
  assert.match(scrollEffect, /container\.scrollTo\(\{ top: container\.scrollHeight, behavior \}\)/);
  assert.match(page, /setPendingUserMessage\(\{ sessionId: activeId, message: userMessage \}\)/);
});

test("question scrolling and the writing indicator respect reduced-motion preferences", () => {
  const scrollEffect = sliceBetween(
    page,
    "const container = scrollRef.current;",
    "}, [messages, loading, activeId, activePendingUserMessage]);",
  );
  assert.match(
    scrollEffect,
    /matchMedia\?\.\("\(prefers-reduced-motion: reduce\)"\)\.matches[\s\S]*?"auto"[\s\S]*?"smooth"/,
  );
  assert.match(
    chatDesign,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.alo-mira-generating-dot,[\s\S]*?animation: none;/,
  );
  assert.match(chatDesign, /\.alo-mira-generating-dot\s*\{[\s\S]*?opacity: 0\.85;/);
});

test("leaving the chat cancels a pending send without leaving its spinner or send lock", () => {
  const viewCleanup = sliceBetween(page, "useEffect(\n    () => () => {", "},\n    [sportAiView],");
  assert.match(
    viewCleanup,
    /generationRef\.current \+= 1;[\s\S]*?if \(sendingRef\.current\)[\s\S]*?sendingRef\.current = false;[\s\S]*?setPendingUserMessage\(null\);[\s\S]*?setLoading\(false\);/,
  );
});
