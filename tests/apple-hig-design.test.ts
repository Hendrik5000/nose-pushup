import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { DEFAULT_DESIGN_STYLE, DESIGN_STYLES } from "../src/lib/design-style.ts";

test("Apple HIG remains the default while all six design styles stay selectable", () => {
  assert.equal(DEFAULT_DESIGN_STYLE, "hig");
  assert.deepEqual(
    DESIGN_STYLES.map((style) => style.id),
    ["soft", "compact", "editorial", "studio", "hig", "performance"],
  );
  assert.deepEqual(
    DESIGN_STYLES.map((style) => style.label),
    ["Klassisch", "Kompakt", "Editorial", "Studio", "Apple HIG", "Performance"],
  );
});

test("settings renders each design style as an accessible selectable option", () => {
  const picker = readFileSync(
    new URL("../src/components/DesignStylePicker.tsx", import.meta.url),
    "utf8",
  );
  assert.match(picker, /DESIGN_STYLES\.map/);
  assert.match(picker, /aria-pressed/);
  assert.match(picker, /data-design-style-option/);
});

test("the shared menu layout renders once and uses the spacious modern shell", () => {
  const menu = readFileSync(
    new URL("../src/components/HomeAppMenuLayout.tsx", import.meta.url),
    "utf8",
  );
  assert.match(menu, /alo-site-directory-page/);
  assert.match(menu, /lg:grid-cols-\[240px_minmax\(0,1fr\)\]/);
  assert.doesNotMatch(menu, /DesignView/);
  assert.doesNotMatch(menu, /sport-only|classic-only/);
});
