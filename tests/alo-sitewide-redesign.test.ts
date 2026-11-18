import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../src/alo-sitewide-redesign.css", import.meta.url), "utf8");
const root = readFileSync(new URL("../src/routes/__root.tsx", import.meta.url), "utf8");
const marketplace = readFileSync(new URL("../src/components/marketplace/MarketplaceAppCatalog.tsx", import.meta.url), "utf8");

test("site-wide redesign is loaded globally after the existing visual layers", () => {
  assert.ok(root.indexOf("aloVisualRefreshCss") < root.indexOf("aloSitewideRedesignCss"));
  assert.match(root, /href: aloSitewideRedesignCss/);
});

test("site-wide surfaces inherit active theme tokens instead of defining a new palette", () => {
  for (const token of ["--background", "--foreground", "--card", "--border", "--primary", "--ring"]) {
    assert.ok(css.includes(`var(${token})`), `missing theme token ${token}`);
  }
  assert.doesNotMatch(css, /#[0-9a-fA-F]{6}/);
});

test("all authenticated pages receive shared layout, card, control and navigation styling", () => {
  for (const selector of [
    ".alo-module-surface main",
    ".alo-page-sidebar-link",
    ".dashboard-widget-grid",
    ".app-homebar .homebar-items",
    "[data-slot="dialog-content"]",
    "[data-slot="sheet-content"]",
    ":focus-visible",
  ]) {
    assert.ok(css.includes(selector), `missing shared site selector ${selector}`);
  }
});

test("Marketplace, Browser and settings have dedicated discovery and navigation treatments", () => {
  for (const selector of [
    ".alo-marketplace-section",
    ".alo-marketplace-search",
    ".alo-marketplace-categories",
    ".alo-marketplace-preview",
    ".alo-browser-tabbar",
    ".settings-category-row",
  ]) {
    assert.ok(css.includes(selector), `missing page-specific selector ${selector}`);
  }
  assert.match(marketplace, /alo-marketplace-preview/);
  assert.match(marketplace, /Stilisierte Darstellung — Alo-Apps nutzen keine externen Screenshots\./);
});

test("sports, football, training, profile and authentication pages share page-specific patterns", () => {
  for (const selector of [
    ".sport-page-intro",
    ".sport-section-label",
    ".sport-focus-card",
    ".sport-feature-card",
    ".sport-public-profile",
    ".sport-auth-page",
    ".run-stat-grid",
  ]) {
    assert.ok(css.includes(selector), `missing page family selector ${selector}`);
  }
});

test("responsive spacing and reduced-motion preferences remain respected", () => {
  assert.match(css, /max-width: 640px/);
  assert.match(css, /min-width: 900px/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});
