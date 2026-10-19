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

function mockGlobals(
  options: { stored?: string | null; blockedRead?: boolean; blockedWrite?: boolean } = {},
) {
  const storage = new Map<string, string>();
  if (options.stored !== undefined && options.stored !== null)
    storage.set("np-design-style", options.stored);
  const localStorage = {
    getItem(key: string) {
      if (options.blockedRead) throw new Error("blocked storage");
      return storage.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      if (options.blockedWrite) throw new Error("blocked storage");
      storage.set(key, value);
    },
  };
  const document = { documentElement: { dataset: {} as Record<string, string> } };
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage } });
  Object.defineProperty(globalThis, "document", { configurable: true, value: document });
  return { storage, document };
}

function restoreGlobal(name: "window" | "document", descriptor: PropertyDescriptor | undefined) {
  if (descriptor) Object.defineProperty(globalThis, name, descriptor);
  else Reflect.deleteProperty(globalThis, name);
}

afterEach(() => {
  restoreGlobal("window", originalWindow);
  restoreGlobal("document", originalDocument);
});

test("catalog exposes all independent design styles and defaults to performance", () => {
  const expected = ["soft", "compact", "editorial", "studio", "performance"];
  assert.deepEqual(
    DESIGN_STYLES.map((style) => style.id),
    expected,
  );
  assert.equal(DEFAULT_DESIGN_STYLE, "performance");
  assert.equal(DESIGN_STYLES.find((style) => style.id === "soft")?.label, "Soft");
  assert.equal(DESIGN_STYLES.find((style) => style.id === "compact")?.label, "Kompakt");
  assert.equal(DESIGN_STYLES.find((style) => style.id === "performance")?.label, "Performance");
  for (const style of DESIGN_STYLES) {
    assert.ok(style.label.length > 0);
    assert.ok(style.description.length > 0);
    assert.equal(isDesignStyleId(style.id), true);
  }
  assert.equal(isDesignStyleId("not-a-style"), false);
  assert.equal(isDesignStyleId(null), false);
  assert.equal(isDesignStyleId(undefined), false);
});

test("stored style safely defaults in SSR, for missing/invalid data, and blocked storage", () => {
  restoreGlobal("window", undefined);
  assert.equal(getStoredDesignStyle(), DEFAULT_DESIGN_STYLE);
  assert.doesNotThrow(() => applyDesignStyle("soft"));
  mockGlobals({ stored: "editorial" });
  assert.equal(getStoredDesignStyle(), "editorial");
  mockGlobals({ stored: "soft" });
  assert.equal(getStoredDesignStyle(), "soft");
  mockGlobals({ stored: "performance" });
  assert.equal(getStoredDesignStyle(), "performance");
  mockGlobals({ stored: "invalid" });
  assert.equal(getStoredDesignStyle(), DEFAULT_DESIGN_STYLE);
  mockGlobals({ blockedRead: true });
  assert.equal(getStoredDesignStyle(), DEFAULT_DESIGN_STYLE);
});

test("each style applies to html and persists only under the design-style storage key", () => {
  const { storage, document } = mockGlobals();
  for (const style of DESIGN_STYLES) {
    applyDesignStyle(style.id);
    assert.equal(document.documentElement.dataset.designStyle, style.id);
    assert.equal(storage.get("np-design-style"), style.id);
    assert.deepEqual([...storage.keys()], ["np-design-style"]);
  }
});

test("application still updates the document when storage writes are blocked", () => {
  const { document } = mockGlobals({ blockedWrite: true });
  assert.doesNotThrow(() => applyDesignStyle("studio"));
  assert.equal(document.documentElement.dataset.designStyle, "studio");
});

test("CSS exposes distinct preview tokens and real dashboard/card/heading/navigation styles", () => {
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  const tokens = [
    "--design-card-radius",
    "--design-heading-font",
    "--design-body-font",
    "--design-gap",
    "--design-border-width",
    "--design-shadow",
  ];
  const valuesByStyle = new Map<string, Record<string, string>>();
  for (const id of ["soft", "compact", "editorial", "studio", "performance"]) {
    const tokenBlock = css.match(
      new RegExp(`\\[data-design-style="${id}"\\]\\s*\\{([^}]*)\\}`),
    )?.[1];
    assert.ok(tokenBlock, `missing nested preview token block for ${id}`);
    for (const token of tokens) assert.match(tokenBlock!, new RegExp(`${token}\\s*:`));
    valuesByStyle.set(
      id,
      Object.fromEntries(
        tokens.map((token) => [
          token,
          tokenBlock!.match(new RegExp(`${token}\\s*:\\s*([^;]+);`))?.[1] ?? "",
        ]),
      ),
    );
  }
  for (const token of ["--design-card-radius", "--design-heading-font", "--design-shadow"])
    assert.equal(
      new Set([...valuesByStyle.values()].map((values) => values[token])).size,
      5,
      `${token} differs across styles`,
    );
  assert.equal(
    new Set([...valuesByStyle.values()].map((values) => values["--design-gap"])).size,
    4,
    "the four existing styles retain distinct gaps; performance may share a gap",
  );
  assert.equal(
    new Set([...valuesByStyle.values()].map((values) => values["--design-border-width"])).size,
    2,
  );

  assert.match(css, /\.dashboard-widget-grid\s*\{\s*gap:\s*var\(--design-gap\)/);
  assert.match(css, /main:has\(\.dashboard-widget-grid\)\s*\{\s*max-width:/);
  assert.match(css, /\.sh-card\s*\{[^}]*border-radius:\s*var\(--design-card-radius\)/s);
  assert.match(css, /\.sh-metric\s*\{[^}]*font-family:\s*var\(--design-body-font\)/s);
  assert.match(
    css,
    /html\[data-design-style\] :is\(h1, h2\)\s*\{\s*font-family:\s*var\(--design-heading-font\)/,
  );
  assert.match(
    css,
    /html\[data-design-style="editorial"\] \.ah-segment a\.active[\s\S]*?border-bottom-color:/,
  );
  assert.match(
    css,
    /html\[data-design-style="studio"\] \.ah-segment a,[\s\S]*?border:\s*var\(--design-border-width\) solid/,
  );
  assert.match(css, /border-width:\s*var\(--design-border-width\) !important/);
  assert.match(css, /padding:\s*var\(--design-card-padding\) !important/);
  assert.match(
    css,
    /html\[data-design-style="editorial"\] \.ah-segment\s*\{[^}]*background:\s*var\(--color-background\)/s,
  );
  assert.match(css, /min-block-size:\s*44px/);
  for (const id of ["soft", "compact", "editorial", "studio", "performance"]) {
    const tokenBlock = css.match(
      new RegExp(`^\\[data-design-style="${id}"\\]\\s*\\{([^}]*)\\}`, "m"),
    )?.[1];
    assert.ok(tokenBlock, `missing root style token block for ${id}`);
    assert.doesNotMatch(tokenBlock!, /--primary\s*:/);
  }
});

test("layered card radii use style tokens and fixed navigation tracks never become transparent", () => {
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  const baseCards = css.match(
    /main section\.rounded-3xl,\s*main \.rounded-3xl\.border\s*\{([^}]*)\}/,
  )?.[1];
  assert.ok(baseCards);
  assert.match(baseCards, /border-radius:\s*var\(--design-card-radius, 16px\) !important/);
  for (const id of ["editorial", "studio"]) {
    const nav = css.match(
      new RegExp(`html\\[data-design-style="${id}"\\] \\.ah-segment\\s*\\{([^}]*)\\}`),
    )?.[1];
    assert.ok(nav);
    assert.match(nav, /background:\s*var\(--color-background\)/);
    assert.doesNotMatch(nav, /background:\s*transparent/);
    assert.equal((nav.match(/background\s*:/g) ?? []).length, 1);
  }
});
