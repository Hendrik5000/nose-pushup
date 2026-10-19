import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (file: string) => readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8");

test("reference refinements load after the shared style sheets", () => {
  const root = read("routes/__root.tsx");
  for (const stylesheet of ["communityReferenceCss", "healthReferenceCss", "aiReferenceCss"]) {
    assert.ok(root.indexOf(`href: ${stylesheet}`) > root.indexOf("href: sportCss"));
  }
});

test("reference interiors keep the global menu and appearance controls", () => {
  const header = read("components/SportAppHeader.tsx");
  assert.match(header, /reference-interior-header/);
  assert.match(header, /reference-page-title/);
  assert.match(header, /hash="appearance"/);
  assert.match(header, /aria-controls="sport-area-menu"/);
});

test("new-group action opens outside the mobile-hidden conversation", () => {
  const chat = read("components/chat/LocalChatShell.tsx");
  const action = chat.indexOf('aria-label="Neuen Gruppenraum erstellen"');
  assert.ok(action > 0);
  assert.ok(chat.indexOf("setNewRoomOpen(true)", action) > action);
  const dialog = chat.indexOf("{newRoomOpen && (");
  assert.ok(dialog > chat.lastIndexOf("</section>"));
  const createRoom = chat.slice(
    chat.indexOf("const onCreateRoom"),
    chat.indexOf("const onStartDm"),
  );
  assert.match(createRoom, /setMobileListOpen\(false\)/);
});

test("new reference styles do not leak into archived selectable designs", () => {
  for (const name of ["community-reference.css", "health-reference.css", "ai-reference.css"]) {
    const css = read(name);
    const selectors = css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{/g);
    for (const [, selector] of selectors) {
      if (selector.trim().startsWith("@")) continue;
      assert.match(selector, /html\[data-design-style="performance"\]/, `${name}: ${selector}`);
    }
  }
});
