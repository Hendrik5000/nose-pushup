import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../src/alo-visual-refresh.css", import.meta.url), "utf8");
const root = readFileSync(new URL("../src/routes/__root.tsx", import.meta.url), "utf8");

test("visual refresh is loaded after the existing responsive and app styles", () => {
  assert.ok(root.indexOf("adaptiveLayoutCss") < root.indexOf("aloVisualRefreshCss"));
  assert.match(root, /href: aloVisualRefreshCss/);
});

test("visual surfaces derive their colors and depth from the active theme tokens", () => {
  assert.match(css, /var\(--foreground\)/);
  assert.match(css, /var\(--card\)/);
  assert.match(css, /var\(--background\)/);
  assert.match(css, /var\(--primary\)/);
  assert.doesNotMatch(css, /#[0-9a-fA-F]{6}/);
});

test("the Alo home launcher receives a distinct visual hierarchy", () => {
  assert.match(css, /\.alo-tablet-home-hub/);
  assert.match(css, /data-home-group-toggle/);
  assert.match(css, /data-home-app-id/);
  assert.match(css, /\.alo-tablet-home-apps/);
});

test("Mira, Nexus, Health and Training receive app-specific visual treatment", () => {
  for (const selector of [
    "sport-ai-home",
    "sport-ai-primary-card",
    "community-conversation",
    "sport-chat-composer",
    "sport-health-page",
    "health-classic-widget-card",
    "alo-training-page",
    "training-hero",
  ]) {
    assert.ok(css.includes(selector), `missing app visual selector: ${selector}`);
  }
});

test("Postfach and Admin share the redesigned page frame", () => {
  assert.match(css, /\.alo-postfach-page/);
  assert.match(css, /\.alo-admin-page/);
});

test("shared navigation, sidebars, dialogs and form controls are covered", () => {
  assert.match(css, /app-homebar/);
  assert.match(css, /alo-page-sidebar/);
  assert.match(css, /data-slot="dialog-content"/);
  assert.match(css, /:focus-visible/);
});

test("reduced motion and narrow-screen home layouts remain supported", () => {
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /max-width: 480px/);
});
