import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  advanceTutorial,
  ALL_TUTORIALS,
  APP_TUTORIALS,
  completeTutorial,
  EMPTY_TUTORIAL_STATE,
  getTutorial,
  isTutorialCompleted,
  loadTutorialState,
  MAIN_TUTORIAL,
  parseTutorialState,
  saveTutorialState,
  shouldAutoStartMainTour,
  startTutorial,
  tutorialStateStorageKey,
} from "../src/lib/tutorials";

class MemoryStorage {
  private readonly entries = new Map<string, string>();
  getItem(key: string) {
    return this.entries.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.entries.set(key, value);
  }
  setRaw(key: string, value: string) {
    this.entries.set(key, value);
  }
}

const read = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");

test("the main tour walks the home screen and asks for real interaction", () => {
  assert.equal(MAIN_TUTORIAL.route, "/");
  assert.ok(MAIN_TUTORIAL.steps.length >= 10, "the main tour stays detailed");
  const interactive = MAIN_TUTORIAL.steps.filter((step) => step.requireInteraction === true);
  assert.ok(interactive.length >= 2, "the tour makes you act yourself");
  const text = MAIN_TUTORIAL.steps.map((step) => `${step.title} ${step.text}`).join(" ");
  for (const keyword of [
    "Gruppe",
    "Favoriten",
    "Marketplace",
    "Mira-Taste",
    "Browser",
    "Shortcuts",
    "Bearbeitungsmodus",
    "Postfach",
  ]) {
    assert.match(text, new RegExp(keyword), `tour covers ${keyword}`);
  }
  for (const selector of [
    '[data-home-group-toggle="intelligence"]',
    '[data-home-app-id="mira"]',
    'button[aria-label="Überall suchen"]',
    ".alo-mira-home-launcher-button",
    '[data-home-app-id="marketplace"]',
  ]) {
    assert.ok(
      MAIN_TUTORIAL.steps.some((step) => step.selector === selector),
      `tour targets ${selector}`,
    );
  }
  const last = MAIN_TUTORIAL.steps.at(-1);
  assert.equal(last?.requireInteraction, true, "the tour ends with the user acting");
});

test("many apps ship their own tutorial with concrete selectors", () => {
  assert.ok(APP_TUTORIALS.length >= 9, "at least nine app tutorials exist");
  const ids = APP_TUTORIALS.map((tutorial) => tutorial.id);
  for (const expected of [
    "mira",
    "nexus",
    "health",
    "sports",
    "football",
    "games",
    "marketplace",
    "browser",
    "settings",
  ]) {
    assert.ok(ids.includes(expected), `tutorial for ${expected}`);
  }
  for (const tutorial of ALL_TUTORIALS) {
    assert.ok(tutorial.steps.length >= 3, `${tutorial.id} has real steps`);
    for (const step of tutorial.steps) {
      assert.ok(step.title.length > 0);
      assert.ok(step.text.length > 20, `${tutorial.id}/${step.id} explains itself`);
    }
  }
  const health = getTutorial("health");
  assert.ok(health?.steps.some((step) => step.selector === "#health-today"));
  const sports = getTutorial("sports");
  assert.ok(sports?.steps.some((step) => step.selector === 'nav[aria-label="Ligaauswahl"]'));
  const marketplace = getTutorial("marketplace");
  assert.ok(marketplace?.steps.some((step) => step.selector === 'form[role="search"] input'));
});

test("tutorial state starts, advances and completes per account", () => {
  const storage = new MemoryStorage();
  assert.deepEqual(loadTutorialState(storage, "user-a"), EMPTY_TUTORIAL_STATE);

  let state = startTutorial(EMPTY_TUTORIAL_STATE, MAIN_TUTORIAL.id);
  saveTutorialState(storage, "user-a", state);
  assert.equal(state.active?.step, 0);
  assert.deepEqual(loadTutorialState(storage, "user-a"), state);
  assert.deepEqual(loadTutorialState(storage, "user-b"), EMPTY_TUTORIAL_STATE);
  assert.notEqual(tutorialStateStorageKey("user-a"), tutorialStateStorageKey("user-b"));

  for (let index = 0; index < MAIN_TUTORIAL.steps.length; index += 1) {
    state = advanceTutorial(state, MAIN_TUTORIAL.id);
  }
  assert.equal(state.active, null);
  assert.equal(isTutorialCompleted(state, MAIN_TUTORIAL.id), true);
  saveTutorialState(storage, "user-a", state);
  assert.deepEqual(loadTutorialState(storage, "user-a"), state);

  assert.throws(() => startTutorial(EMPTY_TUTORIAL_STATE, "does-not-exist"));
  assert.throws(() => parseTutorialState({ completed: ["does-not-exist"], active: null }));
  assert.throws(() => parseTutorialState({ completed: [], active: { id: "main", step: 999 } }));
});

test("the legacy welcome tour marks the main tour as seen without persisting", () => {
  const storage = new MemoryStorage();
  storage.setRaw(`nose-push:tour-seen:v2:user-a`, "1");
  const state = loadTutorialState(storage, "user-a");
  assert.equal(isTutorialCompleted(state, MAIN_TUTORIAL.id), true);
  assert.equal(storage.getItem(tutorialStateStorageKey("user-a")), null);
  assert.equal(shouldAutoStartMainTour(state, storage, "user-a"), false);

  const fresh = new MemoryStorage();
  const freshState = loadTutorialState(fresh, "user-b");
  assert.equal(shouldAutoStartMainTour(freshState, fresh, "user-b"), true);
  const active = startTutorial(freshState, MAIN_TUTORIAL.id);
  assert.equal(shouldAutoStartMainTour(active, fresh, "user-b"), false);
  const completed = completeTutorial(active, MAIN_TUTORIAL.id);
  assert.equal(shouldAutoStartMainTour(completed, fresh, "user-b"), false);
});

test("the overlay spotlights targets, blocks clicks between steps and hands control over", () => {
  const overlay = read("components/tutorial/TutorialOverlay.tsx");
  assert.match(overlay, /boxShadow: "0 0 0 9999px rgba\(0, 0, 0, 0\.65\)"/);
  assert.match(overlay, /pointer-events-none/);
  assert.match(overlay, /requireInteraction/);
  assert.match(overlay, /aria-live="polite"/);
  assert.match(overlay, /event\.key === "Escape"/);
  assert.match(overlay, /scrollIntoView/);
  assert.match(overlay, /addEventListener\("click", onClick, \{ capture: true, once: true \}\)/);
  assert.match(overlay, /shouldAutoStartMainTour/);
  assert.match(overlay, /Jetzt du/);
  assert.match(overlay, /Überspringen/);
  assert.match(overlay, /"pointer-events-none fixed z-\[99\]/);
  assert.match(overlay, /fixed inset-0 z-\[98\]/);
});

test("the overlay is wired into the shell and settings list every tutorial", () => {
  const shell = read("routes/_authenticated/route.tsx");
  assert.match(
    shell,
    /import \{ TutorialOverlay \} from "@\/components\/tutorial\/TutorialOverlay"/,
  );
  assert.match(shell, /<TutorialOverlay userId=\{user\.id\} autoStart \/>/);
  assert.doesNotMatch(shell, /WelcomeTour/);

  const profile = read("routes/_authenticated/profile-page-impl.tsx");
  assert.match(profile, /ALL_TUTORIALS\.map/);
  assert.match(profile, /onStartTutorial/);
  assert.match(profile, /startTutorial/);
  assert.match(profile, /title="Tutorials"/);
  assert.doesNotMatch(profile, /restartWelcomeTour|Willkommenstour/);

  const home = read("routes/_authenticated/index.tsx");
  assert.match(home, /data-home-group-toggle=\{groupId\}/);
});
