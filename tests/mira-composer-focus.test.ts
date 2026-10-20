import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../src/ai-reference.css", import.meta.url), "utf8");

test("Mira's composer has no focus line and retains a visible background focus state", () => {
  const selector = 'html[data-design-style="performance"] .sport-ai-chat-mode .sport-chat-composer textarea:focus-visible';
  const rule = css.slice(css.indexOf(`${selector} {`)).split("}")[0];
  assert.ok(css.includes(`${selector} {`), "focus override is scoped to Mira's message field");
  // Important layered rules outrank unlayered ones: match the global base layer.
  assert.match(css, /@layer base\s*\{\s*html\[data-design-style="performance"\] \.sport-ai-chat-mode \.sport-chat-composer textarea:focus-visible\s*\{/);
  assert.match(rule, /outline: none !important;/);
  assert.match(rule, /background: color-mix\(in srgb, var\(--foreground\) 8%, var\(--card\)\) !important;/);
  assert.match(rule, /border-radius: 0\.5rem;/);
  assert.match(rule, /box-shadow: none;/);
  assert.doesNotMatch(rule, /var\(--(?:ring|primary)\)|outline: \d/);
});

test("chat buttons and other composers retain their existing visible focus ring", () => {
  assert.match(
    css,
    /\.sport-chat-composer :is\(button, textarea\):focus-visible\s*\{\s*outline: 2px solid var\(--ring\);\s*outline-offset: 2px;/,
  );
  const globalCss = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  assert.match(globalCss, /outline: 3px solid var\(--color-ring\) !important;/);
});
