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

test("new onboarding, compact module controls, hidden-by-default legacy nav, and optional context are explicit", () => {
  const tour = read("components/WelcomeTour.tsx");
  assert.match(tour, /nose-push:tour-seen:\$\{VERSION\}/);
  assert.match(tour, /Nose-Pushup/);
  assert.match(tour, /horizontal/);
  assert.match(tour, /Tour kannst du im Profil wiederholen/);
  const shell = read("routes/_authenticated/route.tsx");
  assert.match(shell, /getSwipeDestination/);
  assert.match(shell, /pointerType !== "touch"/);
  const nav = read("components/TopNav.tsx");
  assert.match(nav, /aria-label="Alo · Module"/);
  assert.match(nav, /hidden=\{!barVisible\}\s+inert=\{!barVisible\}/);
  const ai = read("routes/_authenticated/ai.tsx");
  assert.match(ai, /MIRA_CONTEXT_KEY/);
  assert.match(ai, /MiraContextControls/);
  assert.match(read("components/alo/MiraContextControls.tsx"), /checked=\{grants.training\}/);
  assert.match(ai, /untrusted Kontext/);
});

test("Alo header renders one shared area title without a duplicate module line", () => {
  assert.match(
    read("components/SportAppHeader.tsx"),
    /<AloHeaderBrand title=\{identity\.title\} \/>/,
  );
  assert.doesNotMatch(read("components/SportAppHeader.tsx"), /<small>|<strong>/);
  assert.match(
    read("components/AloHeaderBrand.tsx"),
    /title !== "Alo" && <strong>\{title\}<\/strong>/,
  );
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
  const shell = read("routes/_authenticated/route.tsx");
  assert.match(shell, /addEventListener\("touchend"/);
  assert.match(shell, /addEventListener\("touchcancel"/);
  assert.match(shell, /querySelector\('\[aria-modal="true"\]/);
  assert.match(read("lib/ai-context.ts"), /Du bist Mira, die allgemeine KI in Alo/);
});
