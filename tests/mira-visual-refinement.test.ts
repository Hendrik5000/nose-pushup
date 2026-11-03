import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MiraSpark } from "../src/components/mira/MiraSpark.tsx";

const read = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
const page = read("components/mira/SuperAiPage.tsx");
const css = read("ai-reference.css");

test("Mira uses a decorative four-point spark with unique gradients, not a provider logo", () => {
  const markup = renderToStaticMarkup(
    createElement("div", null, createElement(MiraSpark), createElement(MiraSpark)),
  );
  assert.equal((markup.match(/aria-hidden="true"/g) ?? []).length, 2);
  assert.equal((markup.match(/<path /g) ?? []).length, 2);
  const ids = [...markup.matchAll(/<linearGradient id="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, 2);
  for (const color of ["#78e6de", "#a3e8c2", "#e9ed9b"]) assert.ok(markup.includes(color));
  assert.doesNotMatch(markup, /gemini|google|<script|<image/i);
});

test("quiet navy colors stay local to Mira and the authenticated shell has no shared upper header", () => {
  assert.match(
    css,
    /html\[data-design-style="performance"\]\[data-theme="glacier"\] main\.sport-ai-page\s*\{[^}]*--background: #070a14;[^}]*--primary: #56c9ff;[^}]*--accent: #a78bfa;/,
  );
  assert.doesNotMatch(css, /html\[data-design-style="performance"\] main\.sport-ai-page\s*\{/);
  assert.match(css, /radial-gradient\(ellipse at 50% 108%, #173f9b70/);
  assert.match(css, /linear-gradient\(180deg, #05070c 0%, #070a12 58%, #0a1122 100%\)/);
  const shell = read("routes/_authenticated/route.tsx");
  assert.match(shell, /alo-no-global-header/);
  assert.doesNotMatch(shell, /SportAppHeader/);
  assert.match(page, /sport-ai-page/);
});

test("three concise starter tasks only prepare an editable draft", () => {
  const start = page.indexOf('aria-label="Mit einer Aufgabe starten"');
  const starters = page.slice(start, page.indexOf("{messages.map", start));
  for (const id of ["ideas", "draft", "explain"]) assert.ok(starters.includes(`id: "${id}"`));
  for (const icon of ["Lightbulb", "PenLine", "BookOpen"]) assert.ok(starters.includes(icon));
  assert.match(starters, /onClick=\{\(\) => setInput\(tool.prompt\)\}/);
  assert.doesNotMatch(starters, /submit\(|send\(|runMiraPowerAction\(/);
  assert.match(css, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/);
  assert.match(css, /@media \(min-width: 768px\)/);
});

test("Mira chat stays headerless and Home is an in-flow action before the composer", () => {
  assert.doesNotMatch(page, /sport-ai-compact-heading|sport-ai-chat-actions/);
  const stage = page.indexOf('className="sport-chat-stage');
  const home = page.indexOf('className="mira-chat-home-action"');
  const composer = page.indexOf("sport-chat-composer", home);
  assert.ok(stage >= 0 && home > stage, "Home should follow the conversation stage");
  assert.ok(composer > home, "Home should appear before, not over, the composer");
  assert.match(page.slice(home, page.indexOf("</Link>", home)), /Zur Alo-Startseite/);
  const homeRow = css.slice(
    css.indexOf(".mira-chat-bottom-row {"),
    css.indexOf("}", css.indexOf(".mira-chat-bottom-row {")),
  );
  assert.match(homeRow, /flex: 0 0 auto/);
  assert.doesNotMatch(homeRow, /position:\s*(fixed|sticky|absolute)/);
});

test("Mira's sketch header keeps only menu, chat title, profile and settings with room to breathe", () => {
  const headerStart = page.indexOf('sketchLayout ? "alo-mira-sketch-header"');
  const headerEnd = page.indexOf("<MiraGithubRepository />", headerStart);
  const header = page.slice(headerStart, headerEnd);
  const overlay = read("mira-home-overlay.css");

  assert.notEqual(headerStart, -1);
  assert.match(header, /<AloPageSidebarTrigger \/>/);
  assert.match(header, /alo-mira-sketch-title/);
  assert.match(header, /aria-label="Profil öffnen"/);
  assert.match(header, /aria-label="Mira-Einstellungen öffnen"/);
  assert.match(overlay, /grid-template-columns: 2\.75rem minmax\(0, 1fr\) repeat\(2, 2\.75rem\)/);
  assert.match(overlay, /width: 2\.75rem;[\s\S]*?height: 2\.75rem;/);
});

test("empty welcome does not replace saved conversation messages", () => {
  assert.match(page, /messages\.length === 0 && \(\s*<div className="ai-welcome/);
  assert.match(page, /\{messages\.map\(\(m, i\) => \(/);
  assert.match(page, /loadSessions\(\)\[0\]\?\.messages \?\? \[\]/);
});

test("conversation metadata, privacy, history and favorites remain reachable", () => {
  for (const label of [
    "Gesprächsoptionen & Datenschutz",
    "Anbieter für diese Antwort:",
    "Auswahlregel:",
    "Mira-Datenfreigabe",
    "Gespeicherte Chats durchsuchen",
  ])
    assert.ok(page.includes(label));
  const options = page.slice(
    page.indexOf('className="sport-ai-chat-options"'),
    page.indexOf('className="sport-chat-stage'),
  );
  assert.match(options, /aria-label="Favoriten"/);
  assert.match(options, /onClick=\{\(\) => setInput\(favorite\)\}/);
  assert.match(options, /<MiraContextControls/);
  for (const feature of [
    "mira-chat-control-panel",
    "Ansichten & Werkzeuge",
    "Neuer Chat",
    "KI-Einstellungen",
    "Gesprächsverlauf",
    "Runware · Text & Medien",
    "Vorschau nächste Anfrage",
    "Technische Details",
    "<AloHomeLink",
  ])
    assert.ok(options.includes(feature), `missing chat control: ${feature}`);
});

test("attachment preview, explicit submit, microphone and accessible file limits survive", () => {
  const start = page.indexOf('className="sport-ai-chat-main');
  const chat = page.slice(start, page.indexOf('<aside className="sport-ai-chat-aside', start));
  assert.match(chat, /<MiraAttachmentPreview/);
  assert.match(chat, /<MiraAttachmentPicker/);
  assert.match(chat, /void submit\(\)/);
  assert.match(chat, /aria-label="Deine Frage an Mira"/);
  assert.match(chat, /aria-label="Freisprechgespräch mit Mira öffnen"/);
  assert.match(chat, /aria-label="Diktierfunktion öffnen"/);
  assert.match(chat, /onClick=\{\(\) => handleVoiceChatOpenChange\(true\)\}/);
  assert.match(chat, /disabled=\{loading \|\| \(!input.trim\(\) && !attachments.length\)\}/);
  assert.match(chat, /<details className="mira-file-help/);
  for (const limit of ["4 Anhänge", "3 MB", "1 MB", "128 KB", "6000", "PDF: Google"])
    assert.ok(chat.includes(limit));
});

test("small-screen chat keeps a non-floating composer, scrollable messages and safe-area padding", () => {
  assert.match(
    css,
    /main\.sport-ai-chat-mode \.sport-chat-composer\s*\{[^}]*position: static;[^}]*flex: 0 0 auto;/,
  );
  assert.match(
    css,
    /\.sport-ai-chat-mode \.sport-chat-stage\s*\{[^}]*flex: 1 1 0;[^}]*overflow-y: auto;/,
  );
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /mira-chat-home-action\s*\{[^}]*min-height: 44px;/s);
  assert.match(css, /mira-chat-bottom-row\s*\{[^}]*flex: 0 0 auto;/s);
  assert.match(css, /@media \(max-width: 767px\)/);
  assert.match(css, /@media \(min-width: 768px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  const attachments = read("mira-attachments.css");
  assert.match(attachments, /grid-template-columns: 44px minmax\(0, 1fr\) 44px 44px;/);
  assert.match(attachments, /grid-column: 1 \/ -1;/);
  assert.match(attachments, /font-size: 16px;/);
});

test("Mira shows an accessible generation indicator and safely reveals one complete reply", () => {
  const overlay = read("mira-home-overlay.css");
  const submitStart = page.indexOf("const submit = async");
  const submitEnd = page.indexOf("const messagesRef = useRef(messages);", submitStart);
  const submit = page.slice(submitStart, submitEnd);
  const server = read("lib/super-ai.functions.ts");

  assert.equal((page.match(/\{loading && <MiraGeneratingIndicator \/>}/g) ?? []).length, 2);
  assert.match(
    page,
    /function MiraGeneratingIndicator\(\)[\s\S]*?role="status"[\s\S]*?aria-live="polite"/,
  );
  assert.match(page, /setReplyAnimation\(\{ sessionId: activeId, index: nextMsgs.length \}\)/);
  assert.match(submit, /const assistantMessage: Msg = \{[\s\S]*?content: assistantText,/);
  assert.equal((submit.match(/role: "assistant"/g) ?? []).length, 1);
  assert.match(submit, /setMessages\(\[\.\.\.nextMsgs, assistantMessage\]\)/);
  assert.match(page, /MiraAnswerText text=\{m\.content\}/);
  assert.match(page, /aria-live=\{isFreshAssistantReply\(m, i\) \? "polite" : undefined\}/);
  assert.match(overlay, /\.alo-mira-generating-dot\s*\{[\s\S]*?animation:/);
  assert.match(overlay, /\.alo-mira-response-arrival\s*\{[\s\S]*?animation:/);
  assert.match(
    overlay,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.alo-mira-generating-dot,[\s\S]*?\.alo-mira-response-arrival\s*\{\s*animation: none;/,
  );
  assert.doesNotMatch(server, /ReadableStream|text\/event-stream|stream\s*:\s*true/i);
  assert.match(server, /await res\.json\(\)/);
});
