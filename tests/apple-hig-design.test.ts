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
  assert.match(lib, /DEFAULT_DESIGN_STYLE: DesignStyleId = "performance"/);
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
  assert.doesNotMatch(tokenBlock, /--primary\s*:/);
  assert.match(css, /html\[data-design-style="hig"\] aside\[aria-label="App-Aktionen"\]/);
  assert.match(css, /html\[data-design-style="hig"\] \.alo-page-sidebar aside/);
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
