import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, test } from "node:test";
import {
  accessibilityPreferencesKey,
  applyAccessibilityPreferences,
  DEFAULT_ACCESSIBILITY_PREFERENCES,
  readAccessibilityPreferences,
  saveAccessibilityPreferences,
} from "../src/lib/accessibility-preferences";

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");

function mockStorage() {
  const values = new Map<string, string>();
  const localStorage = {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage } });
  return values;
}

function mockDocument() {
  const properties = new Map<string, string>();
  const root = {
    dataset: {} as Record<string, string>,
    style: { setProperty: (key: string, value: string) => properties.set(key, value) },
  };
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { documentElement: root },
  });
  return { root, properties };
}

afterEach(() => {
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
  if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
  else Reflect.deleteProperty(globalThis, "document");
});

test("accessibility preferences are local to the account and invalid values recover to safe defaults", () => {
  const values = mockStorage();
  assert.deepEqual(readAccessibilityPreferences("user-a"), DEFAULT_ACCESSIBILITY_PREFERENCES);
  const preferences = { textScale: 120 as const, reduceMotion: true, keepScreenAwake: true };
  assert.equal(saveAccessibilityPreferences("user-a", preferences), true);
  assert.deepEqual(readAccessibilityPreferences("user-a"), preferences);
  assert.deepEqual(readAccessibilityPreferences("user-b"), DEFAULT_ACCESSIBILITY_PREFERENCES);
  values.set(
    accessibilityPreferencesKey("user-a"),
    JSON.stringify({ textScale: 500, reduceMotion: "yes" }),
  );
  assert.deepEqual(readAccessibilityPreferences("user-a"), DEFAULT_ACCESSIBILITY_PREFERENCES);
});

test("applying preferences changes only local root attributes and a rem scale", () => {
  const { root, properties } = mockDocument();
  applyAccessibilityPreferences({ textScale: 110, reduceMotion: true, keepScreenAwake: false });
  assert.equal(root.dataset.aloTextScale, "110");
  assert.equal(root.dataset.aloReducedMotion, "true");
  assert.equal(properties.get("--alo-font-scale"), "1.1");
  applyAccessibilityPreferences({ textScale: 100, reduceMotion: false, keepScreenAwake: false });
  assert.equal(root.dataset.aloTextScale, "100");
  assert.equal("aloReducedMotion" in root.dataset, false);
});

test("blocked browser storage returns false while preserving the current-tab preference", () => {
  const localStorage = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
  };
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage } });
  const { root } = mockDocument();
  const preferences = { textScale: 110 as const, reduceMotion: false, keepScreenAwake: true };
  assert.equal(saveAccessibilityPreferences("user-a", preferences), false);
  assert.equal(root.dataset.aloTextScale, "110");
});

test("profile controls do not reset app-wide preferences when their panel unmounts", () => {
  const source = readFileSync(
    resolve(process.cwd(), "src/components/AccessibilityControls.tsx"),
    "utf8",
  );
  assert.doesNotMatch(
    source,
    /return\s*\(\)\s*=>\s*applyAccessibilityPreferences\(DEFAULT_ACCESSIBILITY_PREFERENCES\)/,
  );
});
