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
  assert.match(css, /main\.sport-ai-page\s*\{[^}]*--background: #080d16;/);
  assert.match(css, /linear-gradient\(165deg, #0d1625, #070b12 80%\)/);
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
  assert.match(css, /grid-template-columns: minmax\(0, 1fr\);/);
  assert.match(css, /@media \(min-width: 768px\)/);
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
    page.indexOf('<SportSectionLabel number="01">'),
  );
  assert.match(options, /aria-label="Favoriten"/);
  assert.match(options, /onClick=\{\(\) => setInput\(favorite\)\}/);
  assert.match(options, /<MiraContextControls/);
});

test("attachment preview, explicit submit, microphone and accessible file limits survive", () => {
  const start = page.indexOf('className="sport-ai-chat-main');
  const chat = page.slice(start, page.indexOf('<aside className="sport-ai-chat-aside', start));
  assert.match(chat, /<MiraAttachmentPreview/);
  assert.match(chat, /<MiraAttachmentPicker/);
  assert.match(chat, /void submit\(\)/);
  assert.match(chat, /aria-label="Deine Frage an Mira"/);
  assert.match(chat, /aria-label="Spracheingabe"/);
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
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  const attachments = read("mira-attachments.css");
  assert.match(attachments, /grid-template-columns: 44px minmax\(0, 1fr\) 44px 44px;/);
  assert.match(attachments, /grid-column: 1 \/ -1;/);
  assert.match(attachments, /font-size: 16px;/);
});
