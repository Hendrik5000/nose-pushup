import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { planMiraPointerSteps } from "../src/lib/mira-computer-use.ts";

test("pointer plan: apps are opened via the route map", () => {
  const steps = planMiraPointerSteps("Öffne die Einstellungen");
  assert.equal(steps.length, 1);
  assert.deepEqual(steps[0], { kind: "open", label: "Einstellungen", route: "/profile" });

  const sport = planMiraPointerSteps("geh zur Fußball-App");
  assert.equal(sport.length, 1);
  assert.deepEqual(sport[0], { kind: "open", label: "Alo Fußball", route: "/football" });
});

test("pointer plan: multi-step instructions are split into ordered steps", () => {
  const steps = planMiraPointerSteps(
    "Öffne Einstellungen und klicke auf Design, dann scrolle nach unten",
  );
  assert.equal(steps.length, 3);
  assert.equal(steps[0].kind, "open");
  assert.equal(steps[1].kind, "click");
  assert.equal(steps[2].kind, "scroll");
  assert.match(steps[1].kind === "click" ? steps[1].target : "", /[Dd]esign/);
});

test("pointer plan: click, type and scroll are recognized", () => {
  const click = planMiraPointerSteps("Klicke auf Lieblingsteams");
  assert.deepEqual(click[0], { kind: "click", label: "Lieblingsteams", target: "Lieblingsteams" });

  const type = planMiraPointerSteps('Tippe "Krafttraining" in das Suchfeld');
  assert.equal(type[0].kind, "type");
  if (type[0].kind === "type") {
    assert.equal(type[0].text, "Krafttraining");
    assert.match(type[0].target, /[Ss]uchfeld/);
  }

  const scroll = planMiraPointerSteps("Scrolle nach unten");
  assert.deepEqual(scroll[0], { kind: "scroll", label: "Nach unten", direction: "down" });
});

test("pointer plan: search opens the global Alo search", () => {
  const steps = planMiraPointerSteps("Suche nach Push-Up Weltrekord");
  assert.deepEqual(steps[0], { kind: "search", label: "Suche", query: "Push-Up Weltrekord" });
});

test("pointer plan: normal chat text produces no steps", () => {
  assert.deepEqual(planMiraPointerSteps("Erkläre mir das Kreuzheben-Grundmuster"), []);
  assert.deepEqual(planMiraPointerSteps("Schreibe ein Gedicht über den Herbst"), []);
  assert.deepEqual(planMiraPointerSteps(""), []);
});

test("pointer overlay is mounted globally in the root layout", () => {
  const root = readFileSync(new URL("../src/routes/__root.tsx", import.meta.url), "utf8");
  assert.match(root, /MiraPointerOverlay/);
  assert.match(root, /setActiveMiraRouter/);
  const overlay = readFileSync(
    new URL("../src/components/mira/MiraPointerOverlay.tsx", import.meta.url),
    "utf8",
  );
  assert.match(overlay, /mira-pointer/);
  assert.match(overlay, /aria-live="polite"/);
  const superAi = readFileSync(
    new URL("../src/components/mira/SuperAiPage.tsx", import.meta.url),
    "utf8",
  );
  assert.match(superAi, /MiraPointerActivityCard/);
  assert.match(superAi, /runMiraPointerPlan/);
});
