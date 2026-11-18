import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { DEFAULT_DESIGN_STYLE, DESIGN_STYLES } from "../src/lib/design-style.ts";

test("Alo Modern is the only available design language", () => {
  assert.equal(DEFAULT_DESIGN_STYLE, "hig");
  assert.deepEqual(DESIGN_STYLES.map((style) => style.id), ["hig"]);
  assert.equal(DESIGN_STYLES[0]?.label, "Alo Modern");
});

test("legacy visual variants are no longer offered in settings", () => {
  const picker = readFileSync(new URL("../src/components/DesignStylePicker.tsx", import.meta.url), "utf8");
  assert.match(picker, /Einheitliches Design aktiv/);
  assert.doesNotMatch(picker, /DESIGN_STYLES\.map/);
});

test("the shared menu layout renders once and uses the spacious modern shell", () => {
  const menu = readFileSync(new URL("../src/components/HomeAppMenuLayout.tsx", import.meta.url), "utf8");
  assert.match(menu, /alo-site-directory-page/);
  assert.match(menu, /lg:grid-cols-\[240px_minmax\(0,1fr\)\]/);
  assert.doesNotMatch(menu, /DesignView/);
  assert.doesNotMatch(menu, /sport-only|classic-only/);
});
