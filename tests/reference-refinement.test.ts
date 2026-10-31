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

test("reference interiors keep contextual navigation and move global tools into the home hub", () => {
  const home = read("routes/_authenticated/index.tsx");
  const layout = read("routes/_authenticated/route.tsx");
  assert.match(home, /aria-label="Alo-Werkzeuge öffnen"/);
  assert.match(home, /aria-label="Überall suchen"/);
  assert.match(home, /to="\/profile"/);
  assert.match(home, /aria-label="Weitere Alo-Bereiche"/);
  assert.doesNotMatch(layout, /SportAppHeader|<TopNav\s*\/>/);
  assert.match(layout, /className="authenticated-shell alo-no-global-header/);
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
      if (name === "health-reference.css" && selector.includes(".health-classic-")) continue;
      assert.match(selector, /html\[data-design-style="performance"\]/, `${name}: ${selector}`);
    }
  }
});
