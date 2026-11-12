import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MiraProgressiveAnswer } from "../src/components/mira/MiraProgressiveAnswer.tsx";
import { createMiraRevealPlan } from "../src/lib/mira-reveal-plan.ts";

test("progressive Mira reveals use word boundaries and end at the exact full response length", () => {
  const text = "Mira schreibt schrittweise.\n\nDie ganze Antwort bleibt erhalten.";
  const plan = createMiraRevealPlan(text);
  assert.ok(plan.boundaries.length > 0);
  assert.equal(plan.boundaries.at(-1), text.length);
  assert.ok(
    plan.boundaries.every((boundary, index) => boundary > (plan.boundaries[index - 1] ?? 0)),
  );
  assert.ok(plan.durationMs >= 420 && plan.durationMs <= 1800);
  assert.deepEqual(createMiraRevealPlan("").boundaries, []);
});

test("an animated response exposes one complete accessible answer while visual text is hidden from assistive tech", () => {
  const text = "Vollständige Antwort, genau einmal.";
  const markup = renderToStaticMarkup(
    createElement(MiraProgressiveAnswer, { text, animate: true }),
  );
  assert.equal((markup.match(/Vollständige Antwort, genau einmal\./g) ?? []).length, 1);
  assert.match(markup, /aria-hidden="true"[^>]*inert/);
  assert.match(markup, /class="sr-only" role="status" aria-live="polite" aria-atomic="true"/);
});

test("a settled Mira response renders the complete rich-text answer once without motion", () => {
  const text = "**Einmal vollständig** angezeigt.";
  const markup = renderToStaticMarkup(
    createElement(MiraProgressiveAnswer, { text, animate: false }),
  );
  assert.equal((markup.match(/Einmal vollständig/g) ?? []).length, 1);
  assert.match(markup, /<strong>Einmal vollständig<\/strong>/);
  assert.doesNotMatch(markup, /role="status"/);
});
