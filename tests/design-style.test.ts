import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, test } from "node:test";
import {
  applyDesignStyle,
  DEFAULT_DESIGN_STYLE,
  DESIGN_STYLES,
  getStoredDesignStyle,
  isDesignStyleId,
} from "../src/lib/design-style";

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");

function mockGlobals(stored: string | null = null) {
  const storage = new Map<string, string>();
  if (stored) storage.set("np-design-style", stored);
  const localStorage = {
    getItem(key: string) {
      return storage.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      storage.set(key, value);
    },
  };
  const document = { documentElement: { dataset: {} as Record<string, string> } };
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage } });
  Object.defineProperty(globalThis, "document", { configurable: true, value: document });
  return { storage, document };
}

afterEach(() => {
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
  if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
  else Reflect.deleteProperty(globalThis, "document");
});

test("Alo exposes six selectable design styles and keeps the legacy identifier readable", () => {
  assert.equal(DEFAULT_DESIGN_STYLE, "hig");
  assert.deepEqual(
    DESIGN_STYLES.map((style) => style.id),
    ["soft", "compact", "editorial", "studio", "hig", "performance"],
  );
  assert.deepEqual(
    DESIGN_STYLES.map((style) => style.label),
    ["Klassisch", "Kompakt", "Editorial", "Studio", "Apple HIG", "Performance"],
  );
  for (const id of [
    "soft",
    "compact",
    "editorial",
    "studio",
    "hig",
    "performance",
    "legacy-performance",
  ]) {
    assert.equal(isDesignStyleId(id), true);
  }
  assert.equal(isDesignStyleId("not-a-style"), false);
  assert.equal(isDesignStyleId(null), false);
});

test("stored design choices remain selected and the retired performance ID migrates safely", () => {
  for (const style of ["soft", "compact", "editorial", "studio", "hig", "performance"]) {
    const { storage } = mockGlobals(style);
    assert.equal(getStoredDesignStyle(), style);
    assert.equal(storage.get("np-design-style"), style);
  }
  const { storage } = mockGlobals("legacy-performance");
  assert.equal(getStoredDesignStyle(), "performance");
  assert.equal(storage.get("np-design-style"), "performance");
});

test("applying a design style changes the active style and persists the same choice", () => {
  const { storage, document } = mockGlobals();
  applyDesignStyle("editorial");
  assert.equal(document.documentElement.dataset.designStyle, "editorial");
  assert.equal(storage.get("np-design-style"), "editorial");
  applyDesignStyle("performance");
  assert.equal(document.documentElement.dataset.designStyle, "performance");
  assert.equal(storage.get("np-design-style"), "performance");
});

test("design style picker renders the complete selectable style catalog", () => {
  const picker = readFileSync(
    new URL("../src/components/DesignStylePicker.tsx", import.meta.url),
    "utf8",
  );
  assert.match(picker, /DESIGN_STYLES\.map/);
  assert.match(picker, /aria-pressed=\{active === style\.id\}/);
  assert.match(picker, /np-appearance-change/);
});

test("unified design system provides Apple-like typography, whitespace and motion", () => {
  const css = readFileSync(new URL("../src/alo-visual-refresh.css", import.meta.url), "utf8");
  const themeCss = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  assert.match(css, /--alo-page-gutter/);
  assert.match(css, /--alo-section-gap/);
  assert.match(themeCss, /--design-body-font/);
  assert.match(themeCss, /SF Pro Text/);
  assert.match(css, /backdrop-filter: blur/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /overflow-wrap: normal/);
});
