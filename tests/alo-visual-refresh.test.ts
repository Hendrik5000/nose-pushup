import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../src/alo-visual-refresh.css", import.meta.url), "utf8");
const root = readFileSync(new URL("../src/routes/__root.tsx", import.meta.url), "utf8");
const home = readFileSync(new URL("../src/routes/_authenticated/index.tsx", import.meta.url), "utf8");
const marketplace = readFileSync(new URL("../src/components/marketplace/MarketplaceAppCatalog.tsx", import.meta.url), "utf8");
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

test("the home screen keeps its app-hub hierarchy and interaction hooks", () => {
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

test("Marketplace, Browser, Settings, Profile, Postfach and Training retain app-specific hooks", () => {
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

test("secondary routes expose explicit hooks for their shared Alo Modern page treatments", () => {
  const routes = {
    alarm: readFileSync(new URL("../src/routes/_authenticated/alarm.tsx", import.meta.url), "utf8"),
    battle: readFileSync(
      new URL("../src/routes/_authenticated/battle.index.tsx", import.meta.url),
      "utf8",
    ),
    battleLeague: readFileSync(
      new URL("../src/routes/_authenticated/battle-league.tsx", import.meta.url),
      "utf8",
    ),
    battleDetail: readFileSync(
      new URL("../src/routes/_authenticated/battle.$id.tsx", import.meta.url),
      "utf8",
    ),
    calisthenics: readFileSync(
      new URL("../src/routes/_authenticated/calisthenics.tsx", import.meta.url),
      "utf8",
    ),
    clubs: readFileSync(new URL("../src/routes/_authenticated/clubs.tsx", import.meta.url), "utf8"),
    exercises: readFileSync(
      new URL("../src/routes/_authenticated/exercises.tsx", import.meta.url),
      "utf8",
    ),
    leaderboard: readFileSync(
      new URL("../src/routes/_authenticated/leaderboard.tsx", import.meta.url),
      "utf8",
    ),
    profile: readFileSync(
      new URL("../src/routes/_authenticated/profile-page-impl.tsx", import.meta.url),
      "utf8",
    ),
    programs: readFileSync(
      new URL("../src/routes/_authenticated/programs.tsx", import.meta.url),
      "utf8",
    ),
    run: readFileSync(new URL("../src/routes/_authenticated/run.tsx", import.meta.url), "utf8"),
    season: readFileSync(
      new URL("../src/routes/_authenticated/season.tsx", import.meta.url),
      "utf8",
    ),
  };
  for (const [page, hook] of [
    [routes.alarm, "alo-alarm-page"],
    [routes.battle, "alo-battle-page"],
    [routes.battleLeague, "alo-battle-league-page"],
    [routes.battleDetail, "alo-battle-detail-page"],
    [routes.calisthenics, "alo-calisthenics-page"],
    [routes.clubs, "alo-clubs-page"],
    [routes.exercises, "alo-exercises-page"],
    [routes.leaderboard, "alo-leaderboard-page"],
    [routes.profile, "alo-profile-page"],
    [routes.programs, "alo-programs-page"],
    [routes.run, "alo-run-page"],
    [routes.season, "alo-season-page"],
  ]) {
    assert.ok(page.includes(hook), `missing route hook: ${hook}`);
    assert.ok(css.includes(`.${hook}`), `missing route styling: ${hook}`);
  }
  assert.match(css, /\.settings-category-group/);
  assert.match(css, /\.alo-training-focus/);
});
