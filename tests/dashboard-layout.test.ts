import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  DEFAULT_LAYOUT,
  dashboardLayoutStorageKey,
  loadLayout,
  resetLayout,
  saveLayout,
  WIDGET_CATALOG,
} from "../src/lib/dashboard-layout";

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
const USER_A = "user-a";
const STORAGE_KEY = dashboardLayoutStorageKey(USER_A);
const DEFAULT = [{ id: "trainingProgress", size: "lg" }] as const;
const EXPECTED_CATALOG_IDS = [
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
  "habitTracker",
  "ifThenPlan",
  "checklistTemplates",
  "decisionPicker",
  "milestones",
  "worldClock",
];

function mockGlobals(
  options: {
    stored?: string | null;
    blockedRead?: boolean;
    blockedWrite?: boolean;
    userId?: string;
  } = {},
) {
  const storage = new Map<string, string>();
  const writes: Array<[string, string]> = [];
  if (options.stored !== undefined && options.stored !== null)
    storage.set(dashboardLayoutStorageKey(options.userId ?? USER_A), options.stored);
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
    [...EXPECTED_CATALOG_IDS].sort(),
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
  const first = loadLayout(USER_A);
  const second = loadLayout(USER_A);
  assert.deepEqual(first, DEFAULT);
  assert.notStrictEqual(first, DEFAULT_LAYOUT);
  assert.notStrictEqual(first[0], DEFAULT_LAYOUT[0]);
  assert.notStrictEqual(first, second);
  first[0].size = "sm";
  assert.deepEqual(DEFAULT_LAYOUT, DEFAULT);

  const { writes } = mockGlobals();
  assert.deepEqual(loadLayout(USER_A), DEFAULT);
  assert.deepEqual(writes, []);
});

test("personal saved arrays preserve order, sizes, and omitted default widgets without writing", () => {
  const personal = [
    { id: "mood", size: "lg" },
    { id: "readiness", size: "sm" },
    { id: "notes", size: "md" },
  ];
  const { writes } = mockGlobals({ stored: JSON.stringify(personal) });
  assert.deepEqual(loadLayout(USER_A), personal);
  assert.deepEqual(writes, []);

  const oldDefault = [
    { id: "readiness", size: "md" },
    { id: "quickActions", size: "md" },
    { id: "mood", size: "sm" },
  ];
  mockGlobals({ stored: JSON.stringify(oldDefault) });
  assert.deepEqual(loadLayout(USER_A), oldDefault);
});

test("an explicitly empty layout remains empty", () => {
  const { writes } = mockGlobals({ stored: "[]" });
  assert.deepEqual(loadLayout(USER_A), []);
  assert.deepEqual(writes, []);
});

test("invalid JSON, wrong top-level types, invalid items, and duplicates recover safely", () => {
  for (const stored of ["{", "null", "42", '"layout"', "{}", "true"]) {
    mockGlobals({ stored });
    assert.deepEqual(loadLayout(USER_A), DEFAULT, `unexpected result for ${stored}`);
  }

  mockGlobals({ stored: JSON.stringify([null, 3, "mood", {}, { id: "unknown", size: "sm" }]) });
  assert.deepEqual(loadLayout(USER_A), DEFAULT);

  mockGlobals({
    stored: JSON.stringify([
      { id: "readiness", size: "bad" },
      { id: "mood", size: "sm" },
      { id: "readiness", size: "lg" },
      { id: "mood", size: "lg" },
      { id: "notes", size: "md" },
    ]),
  });
  assert.deepEqual(loadLayout(USER_A), [
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
  saveLayout(personal, USER_A);
  assert.deepEqual(writes, [[STORAGE_KEY, JSON.stringify(personal)]]);
  assert.deepEqual(loadLayout(USER_A), personal);

  const reset = resetLayout(USER_A);
  assert.deepEqual(reset, DEFAULT);
  assert.deepEqual(loadLayout(USER_A), DEFAULT);
  assert.equal(storage.get(STORAGE_KEY), JSON.stringify(DEFAULT));
  assert.deepEqual(writes, [
    [STORAGE_KEY, JSON.stringify(personal)],
    [STORAGE_KEY, JSON.stringify(DEFAULT)],
  ]);
});

test("blocked storage reads and writes do not crash", () => {
  mockGlobals({ blockedRead: true });
  assert.doesNotThrow(() => assert.deepEqual(loadLayout(USER_A), DEFAULT));

  const { storage, writes } = mockGlobals({ blockedWrite: true });
  assert.doesNotThrow(() => saveLayout([{ id: "mood", size: "sm" }], USER_A));
  assert.deepEqual(writes, []);
  assert.equal(storage.has(STORAGE_KEY), false);
  assert.doesNotThrow(() => resetLayout(USER_A));
});

test("dashboard layouts are isolated per account in the same browser", () => {
  const { storage } = mockGlobals();
  const layoutA = [{ id: "habitTracker", size: "md" as const }];
  const layoutB = [{ id: "milestones", size: "sm" as const }];

  saveLayout(layoutA, "user-a");
  assert.deepEqual(loadLayout("user-b"), DEFAULT);
  saveLayout(layoutB, "user-b");

  assert.deepEqual(loadLayout("user-a"), layoutA);
  assert.deepEqual(loadLayout("user-b"), layoutB);
  assert.equal(storage.has("np-dashboard-layout-v2"), false);
  assert.deepEqual(loadLayout(null), DEFAULT);
  saveLayout([{ id: "mood", size: "sm" }], null);
  assert.equal(storage.has(dashboardLayoutStorageKey("user-a")), true);
  assert.equal(storage.size, 2);
});
