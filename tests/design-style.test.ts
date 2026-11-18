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

test("Alo exposes one current design while recognizing legacy IDs for migration", () => {
  assert.equal(DEFAULT_DESIGN_STYLE, "hig");
  assert.deepEqual(
    DESIGN_STYLES.map((style) => style.id),
    ["hig"],
  );
  assert.equal(DESIGN_STYLES[0]?.label, "Alo Modern");
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

test("all previously saved design choices migrate to Alo Modern", () => {
  for (const oldStyle of [
    "soft",
    "compact",
    "editorial",
    "studio",
    "performance",
    "legacy-performance",
  ]) {
    const { storage } = mockGlobals(oldStyle);
    assert.equal(getStoredDesignStyle(), "hig");
    assert.equal(storage.get("np-design-style"), "hig");
    assert.equal(storage.get("np-design-style-unified-v1"), "1");
  }
});

test("applying any legacy style keeps the single design and persists it", () => {
  const { storage, document } = mockGlobals();
  applyDesignStyle("editorial");
  assert.equal(document.documentElement.dataset.designStyle, "hig");
  assert.equal(storage.get("np-design-style"), "hig");
  applyDesignStyle("performance");
  assert.equal(document.documentElement.dataset.designStyle, "hig");
});

test("unified design style picker no longer offers legacy design choices", () => {
  const picker = readFileSync(
    new URL("../src/components/DesignStylePicker.tsx", import.meta.url),
    "utf8",
  );
  assert.match(picker, /Alo Modern/);
  assert.match(picker, /Einheitliches Design aktiv/);
  assert.doesNotMatch(picker, /DESIGN_STYLES\.map/);
});

test("unified design system provides Apple-like typography, whitespace and motion", () => {
  const css = readFileSync(new URL("../src/alo-visual-refresh.css", import.meta.url), "utf8");
  assert.match(css, /--alo-page-gutter/);
  assert.match(css, /--alo-section-gap/);
  assert.match(css, /SF Pro Text/);
  assert.match(css, /backdrop-filter: blur/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /overflow-wrap: normal/);
});
