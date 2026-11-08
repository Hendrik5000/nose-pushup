import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  chooseDecision,
  formatWorldClock,
  isValidTimeZone,
  loadPersonalTool,
  localDateKey,
  milestoneDistance,
  parseChecklistItems,
  personalToolStorageKey,
  recentLocalDateKeys,
  savePersonalTool,
} from "../src/lib/dashboard-personal-tools";

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");

function mockStorage(options: { blocked?: boolean } = {}) {
  const values = new Map<string, string>();
  const localStorage = {
    getItem(key: string) {
      if (options.blocked) throw new Error("storage unavailable");
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      if (options.blocked) throw new Error("storage unavailable");
      values.set(key, value);
    },
  };
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage } });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: localStorage });
  return values;
}

afterEach(() => {
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
  if (originalLocalStorage) Object.defineProperty(globalThis, "localStorage", originalLocalStorage);
  else Reflect.deleteProperty(globalThis, "localStorage");
});

test("personal widget storage is account- and tool-scoped, and malformed values recover safely", () => {
  const values = mockStorage();
  const habits = [{ id: "h1", title: "Spazieren", completedDates: ["2026-11-08"] }];
  assert.notEqual(
    personalToolStorageKey("user/one", "habitTracker"),
    personalToolStorageKey("user-two", "habitTracker"),
  );
  assert.notEqual(
    personalToolStorageKey("user-one", "habitTracker"),
    personalToolStorageKey("user-one", "milestones"),
  );
  assert.equal(savePersonalTool("user-one", "habitTracker", habits), true);
  assert.deepEqual(loadPersonalTool("user-one", "habitTracker"), habits);
  assert.deepEqual(loadPersonalTool("user-two", "habitTracker"), []);
  values.set(personalToolStorageKey("user-one", "milestones"), "{broken");
  assert.deepEqual(loadPersonalTool("user-one", "milestones"), []);
});

test("storage failures are reported instead of crashing or claiming a saved value", () => {
  mockStorage({ blocked: true });
  assert.equal(savePersonalTool("user-one", "decisionPicker", ["Lesen"]), false);
  assert.deepEqual(loadPersonalTool("user-one", "worldClock"), [
    { id: "local-berlin", zone: "Europe/Berlin" },
  ]);
});

test("local date keys and the seven-day habit window use the local calendar", () => {
  const lastMinute = new Date(2026, 10, 8, 23, 59);
  assert.equal(localDateKey(lastMinute), "2026-11-08");
  const keys = recentLocalDateKeys(lastMinute);
  assert.equal(keys.length, 7);
  assert.equal(keys[0], "2026-11-02");
  assert.equal(keys[6], "2026-11-08");
});

test("checklist input is trimmed, de-duplicated, bounded, and empty lines are removed", () => {
  assert.deepEqual(parseChecklistItems("Flasche\n\nHandtuch\nflasche\n  Schuhe  "), [
    "Flasche",
    "Handtuch",
    "Schuhe",
  ]);
  assert.equal(
    parseChecklistItems(Array.from({ length: 14 }, (_, index) => `Punkt ${index}`).join("\n"))
      .length,
    12,
  );
  assert.equal(parseChecklistItems("x".repeat(120))[0]?.length, 80);
});

test("decision picker handles empty lists and can be tested deterministically", () => {
  assert.equal(chooseDecision([]), null);
  assert.equal(
    chooseDecision([" Lesen ", "Musik"], () => 0),
    "Lesen",
  );
  assert.equal(
    chooseDecision(["Lesen", "Musik"], () => 0.99),
    "Musik",
  );
  assert.equal(
    chooseDecision(["Lesen"], () => -10),
    "Lesen",
  );
});

test("milestone distances handle future, past, today, annual repeats, and invalid dates", () => {
  const now = new Date(2026, 0, 1, 12);
  assert.deepEqual(milestoneDistance({ date: "2026-01-03", repeatYearly: false }, now), {
    direction: "until",
    days: 2,
  });
  assert.deepEqual(milestoneDistance({ date: "2025-12-30", repeatYearly: false }, now), {
    direction: "since",
    days: 2,
  });
  assert.deepEqual(milestoneDistance({ date: "2026-01-01", repeatYearly: false }, now), {
    direction: "today",
    days: 0,
  });
  assert.deepEqual(milestoneDistance({ date: "2020-02-29", repeatYearly: true }, now), {
    direction: "until",
    days: 58,
  });
  assert.equal(milestoneDistance({ date: "2026-02-30", repeatYearly: false }, now), null);
});

test("world clock validates IANA zones and formats time locally without a network", () => {
  assert.equal(isValidTimeZone("Europe/Berlin"), true);
  assert.equal(isValidTimeZone("Not/A_Zone"), false);
  const formatted = formatWorldClock("UTC", new Date("2026-11-08T13:45:00.000Z"));
  assert.ok(formatted);
  assert.equal(formatted?.time, "13:45");
  assert.match(formatted?.day ?? "", /08/);
  assert.equal(formatWorldClock("Invalid/Zone"), null);
});
