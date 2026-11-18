import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(
  new URL("../src/alo-visual-refresh.css", import.meta.url),
  "utf8",
);
const root = readFileSync(
  new URL("../src/routes/__root.tsx", import.meta.url),
  "utf8",
);
const home = readFileSync(
  new URL("../src/routes/_authenticated/index.tsx", import.meta.url),
  "utf8",
);
const marketplace = readFileSync(
  new URL("../src/components/marketplace/MarketplaceAppCatalog.tsx", import.meta.url),
  "utf8",
);

test("the visual refresh is loaded after the adaptive layout layer", () => {
  assert.ok(root.indexOf("adaptiveLayoutCss") < root.indexOf("aloVisualRefreshCss"));
  assert.ok(root.includes("href: aloVisualRefreshCss"));
});

test("the visual refresh follows selected Alo design styles and existing tokens", () => {
  for (const token of [
    "html[data-design-style]",
    "var(--primary)",
    "var(--card)",
    "var(--border)",
    "var(--design-card-radius",
  ]) {
    assert.ok(css.includes(token), `missing design token usage: ${token}`);
  }
  assert.ok(!css.includes("--primary:"));
  assert.ok(!css.includes("--accent:"));
});

test("the home screen has stable hooks for the visual hierarchy and app tiles", () => {
  assert.ok(home.includes('data-alo-ui-refresh="home"'));
  for (const selector of [
    ".alo-visual-refresh .alo-tablet-home-hub",
    "[data-home-widget-id]",
    "[data-home-app-id]",
    '[aria-label="Dein Tag"]',
  ]) {
    assert.ok(css.includes(selector), `missing home selector: ${selector}`);
  }
});

test("shared navigation, cards and controls receive consistent visual treatment", () => {
  for (const selector of [
    ".alo-page-sidebar",
    ".app-homebar",
    ".alo-page-sidebar-content :is(",
    "textarea, select",
    ":focus-visible",
  ]) {
    assert.ok(css.includes(selector), `missing shared UI selector: ${selector}`);
  }
});

test("Mira, Nexus Chat and Alo Health receive app-specific visual refinement", () => {
  for (const selector of [
    ".sport-ai-chat-mode .mira-chat-suggestion",
    ".alo-mira-sketch-header",
    ".community-conversation",
    ".community-list-heading",
    ".community-search",
    ".health-classic-dashboard .health-classic-hero",
    ".health-classic-widget-card",
    ".sport-health-page .health-daily-hero",
  ]) {
    assert.ok(css.includes(selector), `missing app-specific selector: ${selector}`);
  }
});

test("Admin, Browser, Settings, Profile, Postfach and Training share the refreshed UI", () => {
  for (const selector of [
    ".alo-admin-page > header",
    ".alo-marketplace-search",
    ".alo-marketplace-categories",
    ".alo-marketplace-section",
    ".alo-browser-tabbar",
    ".alo-browser-toolbar",
    ".settings-category-screen",
    ".settings-category-group",
    ".settings-profile-card",
    ".alo-postfach-page article",
    ".alo-training-page .training-progress",
  ]) {
    assert.ok(css.includes(selector), `missing app-area selector: ${selector}`);
  }
  for (const hook of [
    "alo-marketplace-search",
    "alo-marketplace-categories",
    "alo-marketplace-section",
  ]) {
    assert.ok(marketplace.includes(hook), `missing Marketplace hook: ${hook}`);
  }
});

test("motion stays subtle and respects reduced-motion preferences", () => {
  assert.ok(css.includes("@media (hover: hover) and (pointer: fine)"));
  assert.ok(css.includes("prefers-reduced-motion: reduce"));
});
