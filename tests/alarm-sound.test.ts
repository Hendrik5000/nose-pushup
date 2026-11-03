import assert from "node:assert/strict";
import test from "node:test";
import {
  ALARM_MAX_GAIN,
  ALARM_RAMP_SECONDS,
  ALARM_START_GAIN,
  alarmSoundPeak,
  previewAlarmSound,
  primeAlarmAudio,
  startAlarmSound,
  stopAlarmSound,
} from "../src/lib/alarm-sound";

test("alarm starts more audible and rises gently to a bounded peak in 45 seconds", () => {
  assert.ok(ALARM_START_GAIN > 0.045 * 2);
  assert.ok(ALARM_MAX_GAIN > 0.135 * 3);
  assert.ok(ALARM_MAX_GAIN < 1);
  assert.equal(ALARM_RAMP_SECONDS, 45);
  assert.equal(alarmSoundPeak(-1), ALARM_START_GAIN);
  assert.equal(alarmSoundPeak(0), ALARM_START_GAIN);
  let previous = ALARM_START_GAIN;
  for (let second = 1; second <= 90; second++) {
    const peak = alarmSoundPeak(second);
    assert.ok(peak >= previous && peak <= ALARM_MAX_GAIN);
    assert.ok(peak - previous < 0.011, "no sudden loudness jump");
    previous = peak;
  }
  assert.equal(alarmSoundPeak(45), ALARM_MAX_GAIN);
  assert.equal(alarmSoundPeak(600), ALARM_MAX_GAIN);
});

test("audio playback, shortened preview and stop races remain controllable", async (t) => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const timers = new Map<number, { callback: () => void; delay: number }>();
  let timerId = 0;
  let now = 0;
  const clock = t.mock.method(Date, "now", () => now);
  const peaks: number[] = [];
  const oscillators: Array<{ type: string; stopped: boolean; disconnected: boolean }> = [];
  class FakeAudioContext {
    static instance: FakeAudioContext;
    state = "running";
    get currentTime() {
      return now / 1000;
    }
    destination = {};
    resume: () => Promise<void> = async () => {
      this.state = "running";
    };
    constructor() {
      FakeAudioContext.instance = this;
    }
    createGain() {
      return {
        gain: {
          setValueAtTime() {},
          linearRampToValueAtTime(value: number) {
            peaks.push(value);
          },
          exponentialRampToValueAtTime() {},
        },
        connect(node: unknown) {
          return node;
        },
        disconnect() {},
      };
    }
    createOscillator() {
      let ended = () => {};
      const oscillator = {
        type: "sine",
        stopped: false,
        disconnected: false,
        frequency: { setValueAtTime() {} },
        connect(node: unknown) {
          return node;
        },
        addEventListener(_name: string, callback: () => void) {
          ended = callback;
        },
        start() {},
        stop(at?: number) {
          if (at === undefined) {
            this.stopped = true;
            ended();
          }
        },
        disconnect() {
          this.disconnected = true;
        },
      };
      oscillators.push(oscillator);
      return oscillator;
    }
  }
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      AudioContext: FakeAudioContext,
      setTimeout(callback: () => void, delay: number) {
        const id = ++timerId;
        timers.set(id, { callback, delay });
        return id;
      },
      clearTimeout(id: number) {
        timers.delete(id);
      },
    },
  });
  const fire = (id: number) => {
    const timer = timers.get(id);
    assert.ok(timer);
    timers.delete(id);
    timer.callback();
  };
  try {
    assert.equal(await primeAlarmAudio(), true);
    const context = FakeAudioContext.instance;
    assert.notEqual(await startAlarmSound(), null);
    assert.equal(oscillators.at(-1)?.type, "triangle");
    assert.equal(peaks.at(-1), ALARM_START_GAIN);
    assert.equal(timers.get(timerId)?.delay, 1300);
    now = 45_000;
    fire(timerId);
    assert.equal(peaks.at(-1), ALARM_MAX_GAIN);
    assert.equal(timers.get(timerId)?.delay, 950, "notes never overlap their 900ms duration");
    stopAlarmSound();
    assert.equal(timers.size, 0);
    assert.ok(oscillators.every((oscillator) => oscillator.stopped && oscillator.disconnected));

    now = 50_000;
    const stopPreview = await previewAlarmSound(9_000);
    assert.ok(stopPreview);
    const noteTimer = [...timers].find(([, timer]) => timer.delay === 1300)?.[0];
    assert.ok(noteTimer);
    now = 58_000;
    fire(noteTimer);
    assert.equal(peaks.at(-1), ALARM_MAX_GAIN, "9s preview demonstrates the full gentle rise");
    stopPreview();
    assert.equal(timers.size, 0);

    const countBefore = oscillators.length;
    context!.state = "suspended";
    let finishResume!: () => void;
    context!.resume = () =>
      new Promise<void>((resolve) => {
        finishResume = resolve;
      });
    const pendingStart = startAlarmSound();
    stopAlarmSound();
    context!.state = "running";
    finishResume();
    assert.equal(await pendingStart, null, "stop wins even while browser audio unlock is pending");
    assert.equal(oscillators.length, countBefore);
    assert.equal(timers.size, 0);

    context!.state = "suspended";
    context!.resume = async () => {
      throw new Error("blocked");
    };
    assert.equal(await primeAlarmAudio(), false);
    assert.equal(await startAlarmSound(), null);
  } finally {
    stopAlarmSound();
    clock.mock.restore();
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
