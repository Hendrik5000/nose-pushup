import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createMiraRevealPlan } from "../src/lib/mira-reveal-plan.ts";

test("sentence endings receive bounded pauses while decimal points do not", () => {
  const text = "Pi ist 3.14. Wirklich? Ja … Ende!";
  const plan = createMiraRevealPlan(text);
  const boundaryFor = (part: string) => {
    const end = text.indexOf(part) + part.length;
    return text.indexOf(" ", end) === -1 ? text.length : text.indexOf(" ", end) + 1;
  };

  assert.deepEqual(plan.sentenceEndBoundaries, [
    boundaryFor("3.14."),
    boundaryFor("Wirklich?"),
    boundaryFor("Ja …"),
    text.length,
  ]);
  assert.equal(plan.boundaryTimesMs.length, plan.boundaries.length);
  assert.ok(plan.boundaryTimesMs[0] < plan.boundaryTimesMs[1]);
  assert.ok(plan.durationMs >= 420 && plan.durationMs <= 1800);
  assert.ok(plan.boundaryTimesMs.at(-1)! <= plan.durationMs);
});

test("sentence-end punctuation before closing quotes is recognized without changing word boundaries", () => {
  const text = "Sie sagte „Los!“ Dann ging sie.";
  const plan = createMiraRevealPlan(text);

  assert.deepEqual(plan.sentenceEndBoundaries, [text.indexOf("Dann"), text.length]);
  assert.equal(plan.boundaries.at(-1), text.length);
  assert.equal(plan.boundaries.length, text.match(/\S+\s*/gu)?.length);
});

test("the progressive answer consumes planned boundary timings", () => {
  const component = readFileSync(
    new URL("../src/components/mira/MiraProgressiveAnswer.tsx", import.meta.url),
    "utf8",
  );
  assert.match(component, /plan\.boundaryTimesMs\[boundaryCount\]/);
});
