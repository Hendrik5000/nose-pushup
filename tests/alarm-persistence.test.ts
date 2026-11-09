import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  ALARM_SETTINGS_EVENT,
  DEFAULT_ALARM_SETTINGS,
  readAlarmSettings,
  readSavedAlarmSettings,
  saveAlarmSettings,
} from "../src/lib/alarm";
import { scopedStorageKey } from "../src/integrations/supabase/backendScope";

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

function installWindow(storage: MemoryStorage) {
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");
  const events = new EventTarget();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: storage,
      dispatchEvent: events.dispatchEvent.bind(events),
    },
  });
  return {
    events,
    restore() {
      if (original) Object.defineProperty(globalThis, "window", original);
      else Reflect.deleteProperty(globalThis, "window");
    },
  };
}

test("saved schedule survives route teardown, a fresh window and return home without changing its key", () => {
  const storage = new MemoryStorage();
  const schedule = { enabled: true, time: "06:45", lastTriggeredFor: "2026-10-31" };
  let env = installWindow(storage);
  try {
    let signals = 0;
    env.events.addEventListener(ALARM_SETTINGS_EVENT, () => signals++);
    assert.equal(readSavedAlarmSettings("same-account"), null);
    saveAlarmSettings("same-account", schedule);
    assert.equal(signals, 1);
    assert.deepEqual(readAlarmSettings("same-account"), schedule);
    assert.deepEqual([...storage.values.keys()], [scopedStorageKey("alo-alarm", "same-account")]);
    // Route unmounts and page refreshes discard component memory, not localStorage.
    env.restore();
    env = installWindow(storage);
    assert.deepEqual(readSavedAlarmSettings("same-account"), schedule);
    assert.deepEqual(readAlarmSettings("same-account"), schedule);
    saveAlarmSettings("same-account", { enabled: false, time: "08:20" });
    env.restore();
    env = installWindow(storage);
    assert.deepEqual(readSavedAlarmSettings("same-account"), { enabled: false, time: "08:20" });
  } finally {
    env.restore();
  }
});

test("accounts and backend scopes stay isolated; unrelated local data is untouched", () => {
  const storage = new MemoryStorage();
  storage.setItem("unrelated", "keep");
  const env = installWindow(storage);
  try {
    saveAlarmSettings("account-one", { enabled: true, time: "06:45" });
    assert.deepEqual(readAlarmSettings("account-two"), DEFAULT_ALARM_SETTINGS);
    assert.equal(readSavedAlarmSettings("account-two"), null);
    saveAlarmSettings("account-two", { enabled: false, time: "09:00" });
    assert.deepEqual(readAlarmSettings("account-one"), { enabled: true, time: "06:45" });
    assert.deepEqual(readAlarmSettings("account-two"), { enabled: false, time: "09:00" });
    assert.notEqual(
      scopedStorageKey("alo-alarm", "account-one", "supabase:oldbackend"),
      scopedStorageKey("alo-alarm", "account-one", "supabase:otherbackend"),
    );
    assert.equal(storage.getItem("unrelated"), "keep");
  } finally {
    env.restore();
  }
});

test("invalid stored data is not presented as saved and is never silently overwritten", () => {
  const storage = new MemoryStorage();
  const env = installWindow(storage);
  try {
    const key = scopedStorageKey("alo-alarm", "account-one");
    for (const raw of ["broken json", "[]", "null", "{}", '{"enabled":true,"time":"24:00"}']) {
      storage.setItem(key, raw);
      assert.equal(readSavedAlarmSettings("account-one"), null);
      assert.deepEqual(readAlarmSettings("account-one"), DEFAULT_ALARM_SETTINGS);
      assert.equal(storage.getItem(key), raw);
    }
  } finally {
    env.restore();
  }
});

test("validation and storage-write failures cannot claim a successful save", () => {
  const storage = new MemoryStorage();
  const env = installWindow(storage);
  try {
    let signals = 0;
    env.events.addEventListener(ALARM_SETTINGS_EVENT, () => signals++);
    assert.throws(() => saveAlarmSettings("account", { enabled: true, time: "25:00" }));
    storage.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    assert.throws(() => saveAlarmSettings("account", { enabled: true, time: "06:45" }), /Quota/);
    assert.equal(signals, 0);
    assert.equal(readSavedAlarmSettings("account"), null);
  } finally {
    env.restore();
  }
});

test("stable root owns the monitor; alarm saves in its app and Home retains its route", () => {
  const read = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
  const root = read("routes/__root.tsx");
  const layout = read("routes/_authenticated/route.tsx");
  const monitor = read("components/AlarmMonitor.tsx");
  const alarm = read("routes/_authenticated/alarm.tsx");
  const home = read("routes/_authenticated/index.tsx");
  const areas = read("lib/home-app-menus.ts");
  assert.match(root, /<Outlet \/>\s*<\/div>\s*<GlobalAlarmMonitor \/>/);
  assert.doesNotMatch(layout, /<AlarmMonitor/);
  assert.match(monitor, /match.routeId === "\/_authenticated"/);
  assert.match(monitor, /context\?\.user\?\.id \?\? null/);
  assert.match(monitor, /<AlarmMonitor key=\{userId\} userId=\{userId\}/);
  assert.match(alarm, /Route.useRouteContext\(\)/);
  assert.doesNotMatch(alarm, /getAloOwner/);
  assert.match(alarm, /Wecker speichern/);
  assert.match(alarm, /Gespeicherter Wecker/);
  assert.match(alarm, /noch nicht gespeichert/);
  assert.match(home, /id: "areas",[\s\S]*?to: "\/areas"/);
  assert.match(areas, /to: "\/alarm"/);
});
