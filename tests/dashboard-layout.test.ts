import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  DEFAULT_LAYOUT,
  loadLayout,
  resetLayout,
  saveLayout,
  WIDGET_CATALOG,
} from "../src/lib/dashboard-layout";

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
const STORAGE_KEY = "np-dashboard-layout-v2";
const DEFAULT = [{ id: "trainingProgress", size: "lg" }] as const;
const PREVIOUS_CATALOG_IDS = [
  "readiness",
  "briefing",
  "quickActions",
  "mood",
  "water",
  "notes",
  "microChallenge",
  "streakFreeze",
  "recoveryCal",
  "statsRing",
  "reminder",
  "miniBlock",
  "tiles",
  "pushupHero",
  "weekPlan",
  "weeklyReview",
  "aiCoach",
  "challenges",
  "friends",
  "history",
  "exercises",
];

function mockGlobals(
  options: { stored?: string | null; blockedRead?: boolean; blockedWrite?: boolean } = {},
) {
  const storage = new Map<string, string>();
  const writes: Array<[string, string]> = [];
  if (options.stored !== undefined && options.stored !== null)
    storage.set(STORAGE_KEY, options.stored);
  const localStorage = {
    getItem(key: string) {
      if (options.blockedRead) throw new Error("blocked storage read");
      return storage.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      if (options.blockedWrite) throw new Error("blocked storage write");
      writes.push([key, value]);
      storage.set(key, value);
    },
  };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage },
  });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: localStorage });
  return { storage, writes };
}

function restoreGlobal(
  name: "window" | "localStorage",
  descriptor: PropertyDescriptor | undefined,
) {
  if (descriptor) Object.defineProperty(globalThis, name, descriptor);
  else Reflect.deleteProperty(globalThis, name);
}

afterEach(() => {
  restoreGlobal("window", originalWindow);
  restoreGlobal("localStorage", originalLocalStorage);
});

test("catalog keeps every previous widget and defaults exactly to training progress at lg", () => {
  assert.deepEqual(DEFAULT_LAYOUT, DEFAULT);
  assert.deepEqual(
    WIDGET_CATALOG.map(({ id }) => id)
      .filter((id) => id !== "trainingProgress")
      .sort(),
    [...PREVIOUS_CATALOG_IDS].sort(),
  );
  assert.equal(WIDGET_CATALOG.find(({ id }) => id === "trainingProgress")?.defaultSize, "lg");
  assert.equal(WIDGET_CATALOG.find(({ id }) => id === "statsRing")?.label, "Bestwerte & Level");
  assert.match(
    WIDGET_CATALOG.find(({ id }) => id === "statsRing")?.description ?? "",
    /ohne Tagesziel oder Serie/,
  );
});

test("SSR defaults are fresh copies and a missing stored value defaults without writing", () => {
  restoreGlobal("window", undefined);
  restoreGlobal("localStorage", undefined);
  const first = loadLayout();
  const second = loadLayout();
  assert.deepEqual(first, DEFAULT);
  assert.notStrictEqual(first, DEFAULT_LAYOUT);
  assert.notStrictEqual(first[0], DEFAULT_LAYOUT[0]);
  assert.notStrictEqual(first, second);
  first[0].size = "sm";
  assert.deepEqual(DEFAULT_LAYOUT, DEFAULT);

  const { writes } = mockGlobals();
  assert.deepEqual(loadLayout(), DEFAULT);
  assert.deepEqual(writes, []);
});

test("personal saved arrays preserve order, sizes, and omitted default widgets without writing", () => {
  const personal = [
    { id: "mood", size: "lg" },
    { id: "readiness", size: "sm" },
    { id: "notes", size: "md" },
  ];
  const { writes } = mockGlobals({ stored: JSON.stringify(personal) });
  assert.deepEqual(loadLayout(), personal);
  assert.deepEqual(writes, []);

  const oldDefault = [
    { id: "readiness", size: "md" },
    { id: "quickActions", size: "md" },
    { id: "mood", size: "sm" },
  ];
  mockGlobals({ stored: JSON.stringify(oldDefault) });
  assert.deepEqual(loadLayout(), oldDefault);
});

test("an explicitly empty layout remains empty", () => {
  const { writes } = mockGlobals({ stored: "[]" });
  assert.deepEqual(loadLayout(), []);
  assert.deepEqual(writes, []);
});

test("invalid JSON, wrong top-level types, invalid items, and duplicates recover safely", () => {
  for (const stored of ["{", "null", "42", '"layout"', "{}", "true"]) {
    mockGlobals({ stored });
    assert.deepEqual(loadLayout(), DEFAULT, `unexpected result for ${stored}`);
  }

  mockGlobals({ stored: JSON.stringify([null, 3, "mood", {}, { id: "unknown", size: "sm" }]) });
  assert.deepEqual(loadLayout(), DEFAULT);

  mockGlobals({
    stored: JSON.stringify([
      { id: "readiness", size: "bad" },
      { id: "mood", size: "sm" },
      { id: "readiness", size: "lg" },
      { id: "mood", size: "lg" },
      { id: "notes", size: "md" },
    ]),
  });
  assert.deepEqual(loadLayout(), [
    { id: "mood", size: "sm" },
    { id: "readiness", size: "lg" },
    { id: "notes", size: "md" },
  ]);
});

test("save reloads the exact personal layout and reset persists the default", () => {
  const { storage, writes } = mockGlobals();
  const personal = [
    { id: "weekPlan", size: "sm" },
    { id: "trainingProgress", size: "md" },
  ];
  saveLayout(personal);
  assert.deepEqual(writes, [[STORAGE_KEY, JSON.stringify(personal)]]);
  assert.deepEqual(loadLayout(), personal);

  const reset = resetLayout();
  assert.deepEqual(reset, DEFAULT);
  assert.deepEqual(loadLayout(), DEFAULT);
  assert.equal(storage.get(STORAGE_KEY), JSON.stringify(DEFAULT));
  assert.deepEqual(writes, [
    [STORAGE_KEY, JSON.stringify(personal)],
    [STORAGE_KEY, JSON.stringify(DEFAULT)],
  ]);
});

test("blocked storage reads and writes do not crash", () => {
  mockGlobals({ blockedRead: true });
  assert.doesNotThrow(() => assert.deepEqual(loadLayout(), DEFAULT));

  const { storage, writes } = mockGlobals({ blockedWrite: true });
  assert.doesNotThrow(() => saveLayout([{ id: "mood", size: "sm" }]));
  assert.deepEqual(writes, []);
  assert.equal(storage.has(STORAGE_KEY), false);
  assert.doesNotThrow(() => resetLayout());
});
