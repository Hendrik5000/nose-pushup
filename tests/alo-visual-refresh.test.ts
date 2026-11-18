import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../src/alo-visual-refresh.css", import.meta.url), "utf8");
const root = readFileSync(new URL("../src/routes/__root.tsx", import.meta.url), "utf8");
const directory = readFileSync(
  new URL("../src/components/HomeAppMenuLayout.tsx", import.meta.url),
  "utf8",
);
const games = readFileSync(new URL("../src/routes/games.tsx", import.meta.url), "utf8");

test("the shared Alo visual layer is loaded after the adaptive layout", () => {
  assert.ok(root.indexOf("adaptiveLayoutCss") < root.indexOf("aloVisualRefreshCss"));
  assert.match(root, /href: aloVisualRefreshCss/);
});

test("the whole-site layer uses the active Alo theme tokens", () => {
  for (const token of ["--foreground", "--card", "--background", "--primary", "--border"]) {
    assert.ok(css.includes(`var(${token})`), `missing theme token: ${token}`);
  }
  assert.doesNotMatch(css, /#[0-9a-fA-F]{6}/);
});

test("authenticated and public pages receive the shared visual hierarchy", () => {
  assert.match(css, /\.authenticated-shell main/);
  assert.match(css, /main:not\(\.alo-games-page\)/);
  assert.match(css, /:focus-visible/);
});

test("the shared directory shell covers the site catalogues and app directories", () => {
  assert.match(directory, /alo-site-directory-page/);
  assert.match(css, /\.alo-site-directory-page/);
  assert.match(css, /alo-site-directory-page > header/);
});

test("the standalone games hub has its own visual treatment without styling the immersive canvas", () => {
  assert.match(games, /alo-games-page/);
  assert.match(css, /\.alo-games-page/);
  assert.match(css, /:not\(:has\(iframe\)\)/);
});

test("Mira, Nexus, Health, Training, Postfach and Admin keep app-specific visual hooks", () => {
  for (const selector of [
    "sport-ai-home",
    "sport-ai-primary-card",
    "community-conversation",
    "sport-health-page",
    "alo-training-page",
    "alo-postfach-page",
    "alo-admin-page",
  ]) {
    assert.ok(css.includes(selector), `missing app visual selector: ${selector}`);
  }
});

test("the whole-site experience includes restrained motion and honors reduced-motion settings", () => {
  assert.match(css, /@keyframes alo-page-enter/);
  assert.match(css, /@keyframes alo-soft-pop/);
  assert.match(css, /--alo-motion-spring/);
  assert.match(css, /prefers-reduced-motion: no-preference/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /:active/);
});
