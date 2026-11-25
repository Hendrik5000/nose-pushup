import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const home = readFileSync(
  new URL("../src/routes/_authenticated/index.tsx", import.meta.url),
  "utf8",
);

function getRule(selector: RegExp, source = styles) {
  const match = source.match(selector);
  assert.ok(match, `missing CSS rule matching ${selector}`);
  return match[1];
}

test("fullscreen Home page dots keep a 44px by 44px hit target with small visible marks", () => {
  const buttonRule = getRule(
    /body:has\(main\.alo-oneui9-fullscreen-home\)\s+\.alo-launcher-page-dot\s*\{([^}]*)\}/,
  );
  for (const declaration of [
    "width: 44px !important",
    "min-width: 44px !important",
    "height: 44px !important",
    "min-height: 44px !important",
    "flex: 0 0 44px",
    "background: transparent !important",
  ]) {
    assert.ok(buttonRule.includes(declaration), `missing hit-target declaration: ${declaration}`);
  }

  const markRule = getRule(
    /body:has\(main\.alo-oneui9-fullscreen-home\)\s+\.alo-launcher-page-dot::before\s*\{([^}]*)\}/,
  );
  assert.match(markRule, /display:\s*block/);
  assert.match(markRule, /width:\s*0\.25rem/);
  assert.match(markRule, /height:\s*0\.25rem/);
  assert.match(markRule, /background:\s*rgb\(255 255 255\s*\/\s*42%\)/);

  const activeMarkRule = getRule(
    /body:has\(main\.alo-oneui9-fullscreen-home\)\s+\.alo-launcher-page-dot\[aria-current="page"\]::before\s*\{([^}]*)\}/,
  );
  assert.match(activeMarkRule, /width:\s*0\.55rem/);
  assert.match(activeMarkRule, /height:\s*0\.25rem/);
});

test("fullscreen Home page dots remain bottom-aligned, responsive, and selectable buttons", () => {
  const indicatorRule = getRule(
    /body:has\(main\.alo-oneui9-fullscreen-home\)\s+\.alo-launcher-page-indicators\s*\{([^}]*)\}/,
  );
  assert.match(indicatorRule, /align-self:\s*end/);
  assert.match(indicatorRule, /max-width:\s*100%/);
  assert.match(indicatorRule, /overflow-x:\s*auto/);
  assert.match(home, /aria-label=\{`Startseite \$\{page \+ 1\}`\}/);
  assert.match(home, /aria-current=\{currentHomePage === page \? "page" : undefined\}/);
  assert.match(home, /onClick=\{\(\) => setActiveHomePage\(page\)\}/);
});

test("fullscreen Home keeps its black edge-to-edge shell and 10px app icon corners", () => {
  assert.match(
    styles,
    /body:has\(main\.alo-oneui9-fullscreen-home\) main\.alo-oneui9-fullscreen-home\s*\{[^}]*width:\s*100vw !important;[^}]*background:\s*#000 !important;/s,
  );
  assert.match(
    styles,
    /\.alo-oneui9-fullscreen-home \.alo-tablet-home-apps :is\(a, button, div\) > span:first-child\s*\{[^}]*border-radius:\s*10px !important;/s,
  );
});
