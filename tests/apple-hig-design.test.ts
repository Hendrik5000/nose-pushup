import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  applyDesignStyle,
  DESIGN_STYLES,
  getStoredDesignStyle,
  isDesignStyleId,
} from "../src/lib/design-style.ts";

test("the Apple HIG style is a selectable design style next to the existing ones", () => {
  const hig = DESIGN_STYLES.find((style) => style.id === "hig");
  assert.ok(hig, "hig style missing");
  assert.equal(hig?.label, "Apple HIG");
  assert.match(hig?.description ?? "", /Apple-HIG-inspiriert/);
  assert.ok(isDesignStyleId("hig"));
  assert.ok(getStoredDesignStyle() !== undefined);
  assert.ok(DESIGN_STYLES.some((style) => style.id === "performance"));
});

test("the HIG style keeps the current design selectable and untouched", () => {
  const lib = readFileSync(new URL("../src/lib/design-style.ts", import.meta.url), "utf8");
  assert.match(lib, /DEFAULT_DESIGN_STYLE: DesignStyleId = "hig"/);
  assert.match(lib, /np-design-style-default-v2/);
  const picker = readFileSync(
    new URL("../src/components/DesignStylePicker.tsx", import.meta.url),
    "utf8",
  );
  assert.match(picker, /DESIGN_STYLES\.map/);
});

test("the HIG style defines its own tokens without touching the palette", () => {
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  const tokenBlock = css.match(/^\[data-design-style="hig"\]\s*\{([^}]*)\}/m)?.[1];
  assert.ok(tokenBlock, "missing hig token block");
  assert.match(tokenBlock, /--design-card-radius:/);
  assert.match(tokenBlock, /-apple-system/);
  assert.match(tokenBlock, /--design-hig-tint:/);
  assert.match(tokenBlock, /--design-hig-green:/);
  assert.doesNotMatch(tokenBlock, /--primary\s*:/);
  assert.match(css, /html\.dark\[data-design-style="hig"\]/);
  assert.match(css, /html\[data-design-style="hig"\] aside\[aria-label="App-Aktionen"\]/);
  assert.match(css, /html\[data-design-style="hig"\] \.alo-page-sidebar aside/);
});

test("the HIG style renders iOS-like system components", () => {
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  assert.match(css, /html\[data-design-style="hig"\] \[data-slot="dialog-content"\]/);
  assert.match(css, /html\[data-design-style="hig"\] \[role="switch"\]\[data-state="checked"\]/);
  assert.match(css, /html\[data-design-style="hig"\] \[role="checkbox"\]/);
  assert.match(css, /html\[data-design-style="hig"\] \.app-homebar \.homebar-items/);
  assert.match(
    css,
    /html\[data-design-style="hig"\] \[data-slot="dialog-content"\][\s\S]*?backdrop-filter/,
  );
  assert.match(css, /html\[data-design-style="hig"\] ::-webkit-scrollbar-thumb/);
  assert.match(css, /html\[data-design-style="hig"\]\s+input:focus-visible/);
});

test("the HIG style covers every menu and alert surface site-wide", () => {
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  assert.match(css, /html\[data-design-style="hig"\] \[role="alertdialog"\]/);
  assert.match(css, /html\[data-design-style="hig"\] \[role="menu"\]/);
  assert.match(css, /html\[data-design-style="hig"\] \[data-radix-popper-content-wrapper\] > \*/);
  assert.match(css, /html\[data-design-style="hig"\] \.alo-page-sidebar-link\[aria-current\]/);
  assert.match(css, /html\[data-design-style="hig"\] body \{[\s\S]*?font-size: 1\.0625rem/);
});

test("the HIG style gives the home hub an iOS home-screen look", () => {
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  assert.match(css, /html\[data-design-style="hig"\] \.alo-tablet-home-hub/);
  assert.match(
    css,
    /html\[data-design-style="hig"\] \.alo-tablet-home-hub > header :is\(button, a\)/,
  );
  assert.match(
    css,
    /html\[data-design-style="hig"\] \.alo-tablet-home-apps > :is\(a, button, div\)/,
  );
  assert.match(
    css,
    /html\[data-design-style="hig"\] \.alo-tablet-home-apps > :is\(a, button, div\)\s+>\s+span:first-child/,
  );
  assert.match(
    css,
    /html\[data-design-style="hig"\] \.alo-tablet-home-apps > :is\(a, button\)\s+>\s+span:last-child/,
  );
});

test("applying the HIG style sets the data attribute and persists the choice", () => {
  if (typeof document === "undefined") {
    return;
  }
  applyDesignStyle("hig");
  assert.equal(document.documentElement.dataset.designStyle, "hig");
  applyDesignStyle("performance");
  assert.equal(document.documentElement.dataset.designStyle, "performance");
  assert.equal(getStoredDesignStyle(), "performance");
});
