import assert from "node:assert/strict";
import test from "node:test";
import {
  ALO_MODULES,
  getSwipeDestination,
  isModuleSwipeBlocked,
  moduleFromPath,
} from "../src/lib/module-navigation";
import { updateNavigationForScroll } from "../src/lib/navigation-layout";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");

test("Alo keeps three equal primary modules and ordered swipe navigation", () => {
  assert.deepEqual(
    ALO_MODULES.map(({ id }) => id),
    ["nose", "mira", "nexus"],
  );
  assert.equal(getSwipeDestination("/", -80, 5), "/ai");
  assert.equal(getSwipeDestination("/ai", -90, 2), "/chat");
  assert.equal(getSwipeDestination("/chat", 90, 0), "/ai");
  assert.equal(getSwipeDestination("/ai", 90, 0), "/");
  assert.equal(moduleFromPath("/coach"), "mira");
});

test("module swipes require a meaningful, horizontally dominant gesture and respect guards", () => {
  assert.equal(getSwipeDestination("/", -71, 0), null);
  assert.equal(getSwipeDestination("/", -80, 61), null);
  assert.equal(getSwipeDestination("/", -100, 0, true), null);
  assert.equal(getSwipeDestination("/workout/pushup", -100, 0), null);
  assert.equal(isModuleSwipeBlocked(null, "/workout/pushup"), true);
  assert.equal(isModuleSwipeBlocked(null, "/cali-workout/one"), true);
  assert.equal(isModuleSwipeBlocked(null, "/ai"), false);
});

test("optional bar hides after intentional downward scroll, returns upward, and stays visible at top/focus", () => {
  let state = { visible: true, anchorY: 0 };
  state = updateNavigationForScroll(state, 20);
  assert.equal(state.visible, true, "near the top it remains visible");
  state = updateNavigationForScroll(state, 80);
  assert.equal(state.visible, false);
  state = updateNavigationForScroll(state, 15);
  assert.equal(state.visible, true);
  state = updateNavigationForScroll({ visible: false, anchorY: 50 }, 180, true);
  assert.equal(state.visible, true, "focused navigation is not hidden");
  state = updateNavigationForScroll({ visible: false, anchorY: 100 }, 10);
  assert.equal(state.visible, true, "near the top it is available");
});

test("onboarding, swipe, hidden-by-default bottom navigation, and optional context remain explicit", () => {
  const tour = read("components/WelcomeTour.tsx");
  assert.match(tour, /nose-push:tour-seen:\$\{VERSION\}/);
  assert.match(tour, /Training/);
  assert.match(tour, /horizontal/);
  assert.match(tour, /Tour kannst du im Profil wiederholen/);
  const shell = read("routes/_authenticated/route.tsx");
  assert.match(shell, /installModuleSwipeGesture/);
  assert.match(read("lib/module-swipe-gesture.ts"), /getSwipeDestination/);
  const nav = read("components/TopNav.tsx");
  assert.doesNotMatch(nav, /alo-module-switcher|moduleMenu/);
  assert.match(nav, /layout === "bottom" \|\| layout === "floating"/);
  assert.match(nav, /hidden=\{!barVisible\}\s+inert=\{!barVisible\}/);
  const home = read("routes/_authenticated/index.tsx");
  assert.match(home, /aria-label="Alo-Werkzeuge öffnen"/);
  assert.match(home, /aria-label="Überall suchen"/);
  assert.match(home, /aria-label="Weitere Alo-Bereiche"/);
  const ai = read("components/mira/SuperAiPage.tsx");
  assert.match(ai, /MIRA_CONTEXT_KEY/);
  assert.match(ai, /MiraContextControls/);
  assert.match(read("components/alo/MiraContextControls.tsx"), /checked=\{grants.training\}/);
  assert.match(ai, /untrusted Kontext/);
});

test("the shared upper Alo header is absent and area navigation lives in the app hub", () => {
  const layout = read("routes/_authenticated/route.tsx");
  const hub = read("routes/_authenticated/index.tsx");
  assert.doesNotMatch(layout, /SportAppHeader|<TopNav\s*\/>/);
  assert.match(layout, /<AppNavigation\s*\/>/);
  assert.match(hub, /<HubAppIcon to="\/ai"/);
  assert.match(hub, /<HubAppIcon to="\/chat"/);
  assert.match(hub, /<HubAppIcon to="\/exercises"/);
  assert.match(hub, /<HubAppIcon to="\/profile"/);
});

// General defaults must not remove the original optional training helpers.
test("Mira is general by default while all existing sport helpers remain available", () => {
  const tools = read("lib/super-ai-tools.ts");
  for (const id of [
    "week_plan",
    "week_review",
    "form_check",
    "recovery",
    "micro",
    "chat_summary",
    "motivation",
    "pr_strategy",
    "today_checklist",
    "nutrition",
  ]) {
    assert.ok(tools.includes(`id: "${id}"`));
  }
  assert.match(tools, /if \(!canStore\(\)\) return "general"/);
  const shell = read("lib/module-swipe-gesture.ts");
  assert.match(shell, /addEventListener\("touchend"/);
  assert.match(shell, /addEventListener\("touchcancel"/);
  assert.match(shell, /querySelector\('\[aria-modal="true"\]/);
  assert.match(read("lib/ai-context.ts"), /Du bist Mira, die allgemeine KI in Alo/);
});
