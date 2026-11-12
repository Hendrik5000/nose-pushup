import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read = (file: string) => readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8");
test("Mira removes welcome starters while separate Workspace prompts remain editable", () => {
  const ai = read("components/mira/SuperAiPage.tsx");
  assert.doesNotMatch(ai, /aria-label="Mit einer Aufgabe starten"|ai-starter-grid|ai-starter-card/);
  assert.match(ai, /toolsExpanded \? SUPER_TOOLS : SUPER_TOOLS\.slice\(0, 3\)/);
  assert.match(ai, /setInput\(t\.prompt\)/);
});

test("Mira mobile safe-area spacing remains after welcome starters are removed", () => {
  const css = read("ai-reference.css");
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
