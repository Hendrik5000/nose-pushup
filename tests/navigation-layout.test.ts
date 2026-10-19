import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  applyNavigationLayout,
  DEFAULT_NAVIGATION_LAYOUT,
  getStoredNavigationLayout,
  isNavigationLayoutId,
  NAVIGATION_LAYOUTS,
} from "../src/lib/navigation-layout";

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");

function mockGlobals(
  options: { stored?: string | null; blockedRead?: boolean; blockedWrite?: boolean } = {},
) {
  const storage = new Map<string, string>();
  if (options.stored !== undefined && options.stored !== null)
    storage.set("np-navigation-layout", options.stored);
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
  const document = {
    documentElement: {
      dataset: {
        theme: "existing-theme",
        designStyle: "existing-style",
        widgetLayout: "existing-widget",
      } as Record<string, string>,
    },
  };
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

test("catalog exposes four distinct navigation layouts and defaults to floating", () => {
  const expected = ["top", "bottom", "floating", "top-tabs"];
  assert.deepEqual(NAVIGATION_LAYOUTS.map((layout) => layout.id).sort(), expected.sort());
  assert.equal(new Set(NAVIGATION_LAYOUTS.map((layout) => layout.id)).size, 4);
  assert.equal(DEFAULT_NAVIGATION_LAYOUT, "floating");
  for (const layout of NAVIGATION_LAYOUTS) {
    assert.ok(layout.label.length > 0);
    assert.ok(layout.description.length > 0);
    assert.equal(isNavigationLayoutId(layout.id), true);
  }
  assert.equal(isNavigationLayoutId("not-a-layout"), false);
  assert.equal(isNavigationLayoutId(null), false);
  assert.equal(isNavigationLayoutId(undefined), false);
});

test("stored layout safely defaults in SSR, for missing/invalid data, and blocked reads", () => {
  restoreGlobal("window", undefined);
  restoreGlobal("document", undefined);
  assert.equal(getStoredNavigationLayout(), DEFAULT_NAVIGATION_LAYOUT);
  assert.doesNotThrow(() => applyNavigationLayout("top"));

  mockGlobals();
  assert.equal(getStoredNavigationLayout(), DEFAULT_NAVIGATION_LAYOUT);
  mockGlobals({ stored: "top-tabs" });
  assert.equal(getStoredNavigationLayout(), "top-tabs");
  mockGlobals({ stored: "top" });
  assert.equal(getStoredNavigationLayout(), "top");
  mockGlobals({ stored: "floating" });
  assert.equal(getStoredNavigationLayout(), "floating");
  mockGlobals({ stored: "invalid" });
  assert.equal(getStoredNavigationLayout(), DEFAULT_NAVIGATION_LAYOUT);
  mockGlobals({ blockedRead: true });
  assert.equal(getStoredNavigationLayout(), DEFAULT_NAVIGATION_LAYOUT);
});

test("each layout applies to the document and persists under its independent storage key", () => {
  const { storage, document } = mockGlobals();
  for (const layout of NAVIGATION_LAYOUTS) {
    applyNavigationLayout(layout.id);
    assert.equal(document.documentElement.dataset.navigationLayout, layout.id);
    assert.equal(storage.get("np-navigation-layout"), layout.id);
    assert.deepEqual([...storage.keys()], ["np-navigation-layout"]);
    assert.equal(document.documentElement.dataset.theme, "existing-theme");
    assert.equal(document.documentElement.dataset.designStyle, "existing-style");
    assert.equal(document.documentElement.dataset.widgetLayout, "existing-widget");
  }
});

test("application updates the document and tolerates blocked storage writes", () => {
  const { document, storage } = mockGlobals({ blockedWrite: true });
  assert.doesNotThrow(() => applyNavigationLayout("floating"));
  assert.equal(document.documentElement.dataset.navigationLayout, "floating");
  assert.equal(storage.has("np-navigation-layout"), false);
  assert.equal(document.documentElement.dataset.theme, "existing-theme");
  assert.equal(document.documentElement.dataset.designStyle, "existing-style");
  assert.equal(document.documentElement.dataset.widgetLayout, "existing-widget");
});
