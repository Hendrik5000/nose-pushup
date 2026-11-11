import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
const responsiveCss = read("alo-mobile.css");
const homePage = read("routes/_authenticated/index.tsx");
const miraPage = read("components/mira/SuperAiPage.tsx");
const nexusPage = read("components/chat/LocalChatShell.tsx");
const healthPage = read("routes/_authenticated/health.tsx");
const trainingPage = read("routes/_authenticated/exercises.tsx");

const tabletRule = /@media \(min-width: (\d+)px\) and \(max-width: (\d+)px\) \{/;
const tabletRuleMatch = tabletRule.exec(responsiveCss);
const tabletStart = tabletRuleMatch?.index ?? -1;
const landscapeRuleStart = responsiveCss.indexOf(
  "@media (min-width: 1024px) and (max-width: 1279px)",
  tabletStart,
);
const tabletStyles = responsiveCss.slice(tabletStart, landscapeRuleStart);

test("tablet breakpoint covers the requested iPad portrait and landscape CSS viewports", () => {
  assert.ok(tabletRuleMatch, "tablet media query should have an explicit width range");
  assert.notEqual(landscapeRuleStart, -1, "tablet styles should end before the wide-tablet query");

  const minWidth = Number(tabletRuleMatch[1]);
  const maxWidth = Number(tabletRuleMatch[2]);
  const viewports = [
    { width: 768, height: 1024, orientation: "portrait" },
    { width: 834, height: 1194, orientation: "portrait" },
    { width: 1024, height: 768, orientation: "landscape" },
    { width: 1194, height: 834, orientation: "landscape" },
  ] as const;

  for (const viewport of viewports) {
    assert.ok(
      viewport.width >= minWidth && viewport.width <= maxWidth,
      `${viewport.width}×${viewport.height} should match the tablet media range`,
    );
    assert.equal(viewport.width > viewport.height ? "landscape" : "portrait", viewport.orientation);
  }

  const shortLandscapeQuery =
    "@media (min-width: 768px) and (max-width: 1279px) and (orientation: landscape) and (max-height: 850px)";
  assert.ok(responsiveCss.includes(shortLandscapeQuery));
  for (const viewport of viewports) {
    const matchesShortLandscape = viewport.orientation === "landscape" && viewport.height <= 850;
    assert.equal(matchesShortLandscape, viewport.width === 1024 || viewport.width === 1194);
  }
});

test("the tablet rules cover Home, Mira, Nexus, Health, training and Settings", () => {
  for (const selector of [
    "main.alo-tablet-home-page",
    ".alo-tablet-home-apps",
    "main.alo-tablet-mira",
    ".alo-tablet-nexus",
    ".alo-tablet-health",
    "main.alo-tablet-training",
    "main.sport-profile-page",
    'nav[aria-label="Profilbereiche"]',
  ]) {
    assert.ok(tabletStyles.includes(selector), `tablet rules should include ${selector}`);
  }

  for (const [surface, source, className] of [
    ["Home", homePage, "alo-tablet-home-page"],
    ["Mira", miraPage, "alo-tablet-mira"],
    ["Nexus", nexusPage, "alo-tablet-nexus"],
    ["Health", healthPage, "alo-tablet-health"],
    ["Training", trainingPage, "alo-tablet-training"],
  ] as const) {
    assert.ok(source.includes(className), `${surface} should expose its responsive layout hook`);
  }

  assert.match(tabletStyles, /grid-template-columns: repeat\(5, minmax\(0, 108px\)\)/);
  assert.match(tabletStyles, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(tabletStyles, /max-width: 76rem/);
  assert.match(tabletStyles, /env\(safe-area-inset-(left|right|bottom)/);
  assert.match(tabletStyles, /min-width: 0/);
});

test("Mira and Nexus composers stay in flow with safe-area padding; no tablet overlay is added", () => {
  assert.match(tabletStyles, /\.sport-chat-composer\s*\{[^}]*position: static;/s);
  assert.match(
    tabletStyles,
    /\.community-chat-composer, \.sport-chat-composer\)\s*\{[^}]*position: static;/s,
  );
  assert.match(tabletStyles, /padding-bottom: max\([^;]*env\(safe-area-inset-bottom/);
  assert.doesNotMatch(tabletStyles, /position:\s*fixed/);
  assert.doesNotMatch(tabletStyles, /alo-app-header\s*\{/);
});

test("existing narrow mobile assumptions remain separate from tablet rules", () => {
  assert.ok(responsiveCss.includes("@media (max-width: 767px)"));
  assert.ok(responsiveCss.includes("@media (max-width: 420px)"));
  for (const width of [320, 390]) {
    assert.ok(width < Number(tabletRuleMatch?.[1] ?? 0));
    assert.ok(width <= 420);
  }
});
