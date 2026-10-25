import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read = (file: string) => readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8");
test("empty performance coach offers editable starter tasks without sending immediately", () => {
  const ai = read("components/mira/SuperAiPage.tsx");
  const start = ai.indexOf('aria-label="Mit einer Aufgabe starten"');
  assert.ok(start > 0);
  const cards = ai.slice(start, ai.indexOf("{messages.map", start));
  for (const id of ["ideas", "draft", "explain"]) assert.ok(cards.includes(id));
  assert.match(cards, /setInput\(tool.prompt\)/);
  assert.doesNotMatch(cards, /void submit/);
});
test("prompt grid overrides the old welcome icon container and keeps intrinsic height", () => {
  const css = read("ai-reference.css");
  assert.match(css, /\.ai-welcome > \.ai-starter-grid\s*\{[^}]*height: auto;[^}]*flex-shrink: 0;/);
  assert.match(css, /padding-bottom: max\(1rem, calc\(env\(safe-area-inset-bottom\)/);
});
test("community keeps account outside a shrinking scroll region and wraps quick actions", () => {
  const css = read("community-reference.css");
  assert.match(css, /\.community-list-scroll\s*\{[^}]*min-height: 0;/);
  assert.match(css, /\.community-account\s*\{\s*flex-shrink: 0;/);
  assert.match(css, /\.community-quick-replies\s*\{[^}]*flex-wrap: wrap;[^}]*overflow: visible;/);
  assert.match(css, /\[data-navigation-layout\] \.app-homebar \.homebar-link span/);
});

test("Mira keeps coach-chat view and exposes Nexus navigation", () => {
  assert.match(read("components/mira/SuperAiPage.tsx"), /view === "chat"\s*\?\s*"Mira-Chat"/);
  assert.match(read("components/TopNav.tsx"), /label: "Nexus Chat"/);
});
