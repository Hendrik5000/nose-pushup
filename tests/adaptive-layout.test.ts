import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../src/adaptive-layout.css", import.meta.url), "utf8");
const root = readFileSync(new URL("../src/routes/__root.tsx", import.meta.url), "utf8");

test("adaptive layout is loaded after the established responsive stylesheet", () => {
  assert.ok(root.indexOf("aiResponsiveCss") < root.indexOf("adaptiveLayoutCss"));
  assert.match(root, /href: adaptiveLayoutCss/);
});

test("viewport foundations support modern dynamic browser chrome and a 320px minimum", () => {
  assert.match(css, /min-width: 320px/);
  assert.match(css, /100svh/);
  assert.match(css, /100dvh/);
  assert.match(css, /text-size-adjust: 100%/);
});

test("fluid rules cover narrow panes, portrait, ultrawide and short landscape ratios", () => {
  for (const query of [
    "@media (max-width: 480px)",
    "@media (min-width: 600px) and (orientation: portrait)",
    "@media (min-width: 1440px)",
    "@media (min-width: 1800px) and (min-aspect-ratio: 16/9)",
    "@media (orientation: landscape) and (max-height: 700px)",
  ]) {
    assert.ok(css.includes(query), `missing adaptive viewport rule: ${query}`);
  }
});

test("content cannot impose fixed minimum widths or overflow its responsive parent", () => {
  assert.match(
    css,
    /#root, \.authenticated-shell, \.authenticated-shell > \*\s*\{[^}]*min-width: 0/s,
  );
  assert.match(css, /overflow-wrap: anywhere/);
  assert.match(css, /max-width: 100%/);
  assert.match(css, /grid-template-columns: repeat\(auto-fit/);
});

test("short landscape chat and expanded settings remain scrollable within available height", () => {
  assert.match(css, /max-height: 38dvh/);
  assert.match(css, /overflow-y: auto/);
  assert.match(css, /overscroll-behavior: contain/);
});

test("reduced-motion preference remains respected", () => {
  assert.match(css, /prefers-reduced-motion: reduce/);
});
