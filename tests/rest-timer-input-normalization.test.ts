import assert from "node:assert/strict";
import test from "node:test";
import { suggestRest } from "../src/lib/rest-timer";

test("valid RPE and form values preserve the existing suggestions", () => {
  assert.deepEqual(suggestRest({ rpe: 9, formScore: 2 }), {
    seconds: 135,
    label: "Lange Pause",
    reason: "Hohe Anstrengung — nimm dir die Zeit.",
    usedDefaults: false,
  });
  assert.deepEqual(suggestRest({ rpe: 6, formScore: 5, exerciseId: "plank" }), {
    seconds: 37,
    label: "Kurzpause",
    reason: "Passt zu deiner letzten Leistung.",
    usedDefaults: false,
  });
});

test("missing and non-finite runtime values use the documented defaults", () => {
  for (const input of [
    {},
    { rpe: Number.NaN, formScore: 3 },
    { rpe: 6, formScore: Number.POSITIVE_INFINITY },
    { rpe: Number.NEGATIVE_INFINITY, formScore: Number.NaN },
  ]) {
    const suggestion = suggestRest(input);
    assert.equal(suggestion.seconds, 55);
    assert.equal(suggestion.usedDefaults, true);
  }
});

test("finite outliers are clamped to RPE 1–10 and form 1–5", () => {
  assert.equal(suggestRest({ rpe: 100, formScore: 3 }).seconds, 120);
  assert.equal(suggestRest({ rpe: -100, formScore: 3 }).seconds, 40);
  assert.equal(suggestRest({ rpe: 6, formScore: -100 }).seconds, 70);
  assert.equal(suggestRest({ rpe: 6, formScore: 100 }).seconds, 45);
  assert.equal(suggestRest({ rpe: 100, formScore: 100 }).usedDefaults, false);
});

test("all suggestions remain within 20–180 seconds", () => {
  for (const rpe of [-100, 1, 10, 100]) {
    for (const formScore of [-100, 1, 5, 100]) {
      const seconds = suggestRest({ rpe, formScore }).seconds;
      assert.ok(seconds >= 20 && seconds <= 180);
    }
  }
});

test("rest timer controls have mobile touch targets, visible focus, and reduced-motion support", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(
    new URL("../src/components/SmartRestTimer.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /min-h-11 min-w-11/);
  assert.match(source, /focus-visible:ring-2/);
  assert.match(source, /motion-reduce:transition-none/);
});
