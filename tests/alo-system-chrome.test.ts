import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const chrome = readFileSync(
  new URL("../src/components/alo/AloSystemChrome.tsx", import.meta.url),
  "utf8",
);
const navigation = readFileSync(
  new URL("../src/components/TopNav.tsx", import.meta.url),
  "utf8",
);
const layouts = readFileSync(
  new URL("../src/lib/navigation-layout.ts", import.meta.url),
  "utf8",
);
const styles = readFileSync(new URL("../src/alo-system-chrome.css", import.meta.url), "utf8");

test("Alo system chrome exposes visible system controls and the complete app directory", () => {
  const routes = [
    "/",
    "/ai",
    "/chat",
    "/exercises",
    "/marketplace",
    "/profile",
    "/areas",
    "/tools",
  ];
  for (const route of routes) {
    assert.ok(chrome.includes(`to: "${route}"`), `missing app shortcut ${route}`);
  }
  assert.match(chrome, /aria-label="Zurück"/);
  assert.match(chrome, /aria-label="Alo durchsuchen"/);
  assert.match(chrome, /aria-label="Kontrollzentrum öffnen"/);
  assert.match(chrome, /applyThemeMode\(mode\)/);
  assert.match(chrome, /applyCustomAccent\(color\)/);
});

test("all four navigation layouts are rendered globally and only bottom layouts auto-hide", () => {
  for (const layout of ["top", "top-tabs", "bottom", "floating"]) {
    assert.match(layouts, new RegExp(`id: "${layout}"`));
  }
  assert.doesNotMatch(navigation, /hideModuleChrome/);
  assert.match(navigation, /enabled && \(!bottomLayout \|\| scrollVisible\)/);
});

test("top navigation is stacked below the system bar with safe-area support", () => {
  assert.match(styles, /--alo-system-chrome-height/);
  assert.match(styles, /env\(safe-area-inset-top\)/);
  assert.match(styles, /data-navigation-layout="top-tabs"/);
  assert.match(styles, /data-navigation-layout="top"/);
});
