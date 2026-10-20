import assert from "node:assert/strict";
import test from "node:test";
import {
  feedbackLevelUp,
  feedbackLose,
  feedbackRep,
  feedbackSuccess,
  feedbackWin,
  isHapticsEnabled,
  isSoundEnabled,
  setHapticsEnabled,
  setSoundEnabled,
} from "../src/lib/feedback.ts";

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

class FakeAudioContext {
  static instance: FakeAudioContext | null = null;
  state = "running";
  currentTime = 1;
  destination = {};
  resume: () => Promise<void> = async () => undefined;
  createOscillator = () => ({
    type: "sine",
    frequency: {
      setValueAtTime() {},
      exponentialRampToValueAtTime() {},
    },
    connect(node: unknown) {
      return node;
    },
    start() {},
    stop() {},
  });
  createGain = () => ({
    gain: {
      setValueAtTime() {},
      exponentialRampToValueAtTime() {},
    },
    connect(node: unknown) {
      return node;
    },
  });

  constructor() {
    FakeAudioContext.instance = this;
  }
}

async function withGlobals<T>(
  windowValue: object,
  navigatorValue: object,
  callback: () => T | Promise<T>,
): Promise<T> {
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const oldNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: windowValue,
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: navigatorValue,
  });
  try {
    return await callback();
  } finally {
    if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow);
    else Reflect.deleteProperty(globalThis, "window");
    if (oldNavigator) Object.defineProperty(globalThis, "navigator", oldNavigator);
    else Reflect.deleteProperty(globalThis, "navigator");
  }
}

function windowWith(storage: object, audioContext: unknown = FakeAudioContext) {
  return { localStorage: storage, AudioContext: audioContext };
}

test("memory preferences work and successful feedback uses available optional APIs", async () => {
  const storage = new MemoryStorage();
  const vibrations: Array<number | number[]> = [];
  await withGlobals(
    windowWith(storage),
    { vibrate: (pattern: number | number[]) => vibrations.push(pattern) },
    () => {
      assert.equal(isSoundEnabled(), true);
      assert.equal(isHapticsEnabled(), true);
      setSoundEnabled(false);
      setHapticsEnabled(false);
      assert.equal(isSoundEnabled(), false);
      assert.equal(isHapticsEnabled(), false);
      setSoundEnabled(true);
      setHapticsEnabled(true);

      feedbackSuccess();
      assert.deepEqual(vibrations, [[25, 40, 25]]);
      assert.ok(FakeAudioContext.instance);
    },
  );
});

test("inaccessible preferences disable optional sound and haptics without throwing", async () => {
  const vibrations: unknown[] = [];
  const storage = {
    getItem() {
      throw new Error("storage read denied");
    },
    setItem() {
      throw new Error("storage write denied");
    },
  };
  const unavailableStorageWindow = {};
  Object.defineProperty(unavailableStorageWindow, "localStorage", {
    configurable: true,
    get() {
      throw new Error("localStorage getter denied");
    },
  });

  await withGlobals(
    unavailableStorageWindow,
    { vibrate: (pattern: unknown) => vibrations.push(pattern) },
    () => {
      assert.equal(isSoundEnabled(), false);
      assert.equal(isHapticsEnabled(), false);
      assert.doesNotThrow(() => setSoundEnabled(true));
      assert.doesNotThrow(() => setHapticsEnabled(true));
      feedbackSuccess();
      assert.deepEqual(vibrations, []);
    },
  );

  await withGlobals(windowWith(storage), { vibrate: () => vibrations.push("unexpected") }, () => {
    assert.equal(isSoundEnabled(), false);
    assert.equal(isHapticsEnabled(), false);
    feedbackSuccess();
    assert.deepEqual(vibrations, []);
  });
});

test("audio failures and rejected resume promises never escape or reject unhandled", async () => {
  const storage = new MemoryStorage();
  const vibrations: unknown[] = [];
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => unhandled.push(reason);
  process.on("unhandledRejection", onUnhandled);

  try {
    await withGlobals(
      windowWith(storage),
      { vibrate: (pattern: unknown) => vibrations.push(pattern) },
      async () => {
        const audio = FakeAudioContext.instance;
        assert.ok(audio);
        audio.state = "suspended";
        audio.resume = () => Promise.reject(new Error("resume denied"));
        audio.createOscillator = () => {
          throw new Error("oscillator unavailable");
        };
        assert.doesNotThrow(() => feedbackSuccess());
        assert.deepEqual(vibrations, [[25, 40, 25]]);
        await new Promise((resolve) => setImmediate(resolve));
        assert.deepEqual(unhandled, []);

        const constructorFailureWindow = {
          localStorage: storage,
          get AudioContext(): never {
            throw new Error("AudioContext getter denied");
          },
        };
        await withGlobals(
          constructorFailureWindow,
          {
            vibrate: () => {
              throw new Error("vibrate denied");
            },
          },
          () => {
            assert.doesNotThrow(() => {
              feedbackRep(10);
              feedbackLevelUp();
              feedbackWin();
              feedbackLose();
              feedbackSuccess();
            });
          },
        );
      },
    );
  } finally {
    process.off("unhandledRejection", onUnhandled);
  }
});
