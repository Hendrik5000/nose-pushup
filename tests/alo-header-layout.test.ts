import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import postcss from "postcss";

const read = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
const css = read("alo-header-layout.css");
const parsed = postcss.parse(css);
function declaration(selectorPart: string, property: string) {
  const values: string[] = [];
  parsed.walkRules((rule) => {
    if (rule.selector.includes(selectorPart))
      rule.walkDecls(property, (decl) => {
        values.push(decl.value);
      });
  });
  return values;
}

test("authenticated areas render no shared Alo header or fixed upper module switcher", () => {
  const layout = read("routes/_authenticated/route.tsx");
  const navigation = read("components/TopNav.tsx");
  assert.match(layout, /className="authenticated-shell alo-no-global-header/);
  assert.doesNotMatch(layout, /<SportAppHeader\s*\/>|<TopNav\s*\/>/);
  assert.match(layout, /<AppNavigation\s*\/>/);
  assert.doesNotMatch(layout, /module-menu\.css|mira-immersive\.css/);
  assert.doesNotMatch(navigation, /alo-module-switcher|moduleMenu/);
  assert.match(navigation, /layout === "bottom" \|\| layout === "floating"/);
  assert.match(navigation, /hidden=\{!barVisible\}[\s\S]*?inert=\{!barVisible\}/);
});

test("authenticated content starts below the body safe area without a reserved header row", () => {
  for (const [property, value] of [
    ["padding-top", "0"],
    ["--homebar-top-space", "0px"],
    ["--alo-header-space", "0px"],
  ]) {
    const values = declaration(".authenticated-shell.alo-no-global-header", property);
    assert.ok(values.length >= 2 && values.every((current) => current === value), property);
  }
  assert.match(css, /\.alo-no-global-header > \.alo-module-surface\s*\{\s*padding-top: 0/);
  assert.match(read("styles.css"), /body\s*\{[\s\S]*?padding-top: env\(safe-area-inset-top/);
  assert.doesNotMatch(css, /alo-header-first|alo-top-module-offset/);
});

test("swipe and bottom-navigation alternatives remain while all former header destinations move into the hub", () => {
  const layout = read("routes/_authenticated/route.tsx");
  const hub = read("routes/_authenticated/index.tsx");
  const swipe = read("lib/module-swipe-gesture.ts");
  assert.match(layout, /installModuleSwipeGesture/);
  assert.match(swipe, /getSwipeDestination/);
  assert.match(hub, /aria-label="Alo-Werkzeuge öffnen"/);
  assert.match(hub, /detail: "menu"/);
  assert.match(hub, /aria-label="Überall suchen"/);
  assert.match(hub, /detail: "search"/);
  for (const route of [
    "/health",
    "/programs",
    "/calisthenics",
    "/run",
    "/season",
    "/battle",
    "/battle-league",
    "/leaderboard",
    "/clubs",
  ]) {
    assert.ok(hub.includes(`to: "${route}"`), `hub should link to ${route}`);
  }
  assert.match(read("components/TopNav.tsx"), /\{ to: "\/ai", label: "Mira"/);
  assert.match(read("components/TopNav.tsx"), /\{ to: "\/chat", label: "Nexus Chat"/);
});

test("headerless secondary pages retain a visible title and an in-content way back", () => {
  const health = read("routes/_authenticated/health.tsx");
  const calisthenics = read("routes/_authenticated/calisthenics.tsx");
  const run = read("routes/_authenticated/run.tsx");
  const battleLeague = read("routes/_authenticated/battle-league.tsx");
  const homeLink = read("components/AloHomeLink.tsx");
  assert.match(
    health,
    /<div className="health-page-intro">[\s\S]*?title="Gesundheit"[\s\S]*?<AloHomeLink\b/,
  );
  assert.match(
    calisthenics,
    /<SportPageIntro[\s\S]*?title="Baue echte Kontrolle auf"[\s\S]*?<AloHomeLink\b/,
  );
  assert.match(
    run,
    /<SportPageIntro[\s\S]*?title="Dein Lauf\. Dein Tempo\."[\s\S]*?<AloHomeLink\b/,
  );
  assert.match(
    battleLeague,
    /<SportPageIntro[\s\S]*?title="Jede Runde zählt\."[\s\S]*?to="\/battle"/,
  );
  assert.match(
    battleLeague,
    /<SportPageIntro[\s\S]*?title="Jede Runde zählt\."[\s\S]*?<AloHomeLink\b/,
  );
  assert.match(homeLink, /to="\/"/);
});
