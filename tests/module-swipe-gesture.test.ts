import assert from "node:assert/strict";
import test from "node:test";
import { installModuleSwipeGesture } from "../src/lib/module-swipe-gesture";

class FakeWindow {
  innerWidth = 400;
  listeners = new Map<string, Set<(event: unknown) => void>>();
  frames = new Map<number, FrameRequestCallback>();
  nextFrame = 1;
  reducedMotion = false;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    const set = this.listeners.get(type) ?? new Set();
    set.add(
      typeof listener === "function"
        ? (listener as (event: unknown) => void)
        : (event) => listener.handleEvent(event as Event),
    );
    this.listeners.set(type, set);
  }
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    this.listeners
      .get(type)
      ?.delete(
        typeof listener === "function"
          ? (listener as (event: unknown) => void)
          : (event) => listener.handleEvent(event as Event),
      );
  }
  dispatch(type: string, event: object = {}) {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener(event);
  }
  requestAnimationFrame(callback: FrameRequestCallback) {
    const id = this.nextFrame++;
    this.frames.set(id, callback);
    return id;
  }
  cancelAnimationFrame(id: number) {
    this.frames.delete(id);
  }
  flushFrames() {
    const frames = [...this.frames.values()];
    this.frames.clear();
    frames.forEach((callback) => callback(0));
  }
  matchMedia() {
    return { matches: this.reducedMotion };
  }
}

class FakeElement {
  parentElement: FakeElement | null = null;
  scrollWidth = 400;
  clientWidth = 400;
  overflowX = "visible";
  blocked = false;
  constructor(public name = "surface") {}
  closest<T extends HTMLElement>(selector: string): T | null {
    if (selector === "*") return this as unknown as T;
    return this.blocked ? (this as unknown as T) : null;
  }
}

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((done) => (resolve = done));
  return { promise, resolve };
}

function setup(reducedMotion = false) {
  const fakeWindow = new FakeWindow();
  fakeWindow.reducedMotion = reducedMotion;
  const dataset: Record<string, string> = {};
  let modal = false;
  const originals = ["window", "document", "Element", "getComputedStyle"].map(
    (key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const,
  );
  Object.defineProperty(globalThis, "window", { configurable: true, value: fakeWindow });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      documentElement: { dataset },
      querySelector: () => (modal ? {} : null),
    },
  });
  Object.defineProperty(globalThis, "Element", { configurable: true, value: FakeElement });
  Object.defineProperty(globalThis, "getComputedStyle", {
    configurable: true,
    value: (element: FakeElement) => ({
      overflowX: element.overflowX,
      transform: (element as unknown as HTMLElement).style?.transform || "none",
    }),
  });
  const restore = () => {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  };
  return { window: fakeWindow, dataset, restore, setModal: (value: boolean) => (modal = value) };
}

function createSurface() {
  const element = new FakeElement() as unknown as HTMLElement;
  element.style = { transform: "", willChange: "" } as CSSStyleDeclaration;
  element.isConnected = true;
  const animations: { frames: Keyframe[]; options: KeyframeAnimationOptions; cancelled: number }[] =
    [];
  element.animate = ((frames: Keyframe[], options: KeyframeAnimationOptions) => {
    const finished = deferred<void>();
    const entry = { frames, options, cancelled: 0 };
    animations.push(entry);
    return {
      finished: finished.promise,
      cancel: () => {
        entry.cancelled++;
        finished.resolve();
      },
    } as unknown as Animation;
  }) as HTMLElement["animate"];
  return { element, animations };
}

function touchStart(win: FakeWindow, target: EventTarget, x: number, y = 100) {
  win.dispatch("touchstart", {
    target,
    touches: [{ clientX: x, clientY: y }],
  });
}
function touchMove(win: FakeWindow, target: EventTarget, x: number, y = 100) {
  win.dispatch("touchmove", {
    target,
    touches: [{ clientX: x, clientY: y }],
  });
}
function touchEnd(win: FakeWindow, target: EventTarget, x: number, y = 100) {
  win.dispatch("touchend", {
    target,
    touches: [],
    changedTouches: [{ clientX: x, clientY: y }],
  });
}
async function settleMicrotasks() {
  for (let index = 0; index < 6; index++) await Promise.resolve();
}

for (const direction of ["left", "right"] as const) {
  test(`touch swipe ${direction} hands off the rendered offset and navigates to the adjacent route`, () => {
    const env = setup();
    try {
      const { element, animations } = createSurface();
      const destinations: string[] = [];
      const cleanup = installModuleSwipeGesture(element, {
        getPathname: () => "/ai",
        navigate: async (destination) => void destinations.push(destination),
      });
      const sign = direction === "left" ? -1 : 1;
      touchStart(env.window, element, 200);
      touchMove(env.window, element, 200 + sign * 88);
      assert.equal(
        element.style.transform,
        "",
        "DOM transform writes wait for the animation frame",
      );
      env.window.flushFrames();
      assert.equal(element.style.transform, `translate3d(${sign * 88}px, 0, 0)`);
      touchEnd(env.window, element, 200 + sign * 88);
      assert.equal(destinations[0], direction === "left" ? "/chat" : "/");
      assert.equal(animations[0].frames[0].transform, `translate3d(${sign * 88}px, 0, 0)`);
      cleanup();
    } finally {
      env.restore();
    }
  });
}

test("reverse swipe cancels a post-navigation entrance animation without losing the new gesture", async () => {
  const env = setup();
  try {
    const { element, animations } = createSurface();
    const destinations: string[] = [];
    const cleanup = installModuleSwipeGesture(element, {
      getPathname: () => destinations.at(-1) ?? "/",
      navigate: async (destination) => void destinations.push(destination),
    });
    touchStart(env.window, element, 250);
    touchMove(env.window, element, 150);
    env.window.flushFrames();
    touchEnd(env.window, element, 150);
    assert.equal(destinations[0], "/ai");
    await settleMicrotasks();
    assert.equal(
      animations.length,
      1,
      "the settling animation remains active after navigation settles",
    );

    touchStart(env.window, element, 100);
    touchMove(env.window, element, 220);
    env.window.flushFrames();
    assert.equal(
      element.style.transform,
      "translate3d(20px, 0, 0)",
      "the new drag adds to the visible offset",
    );
    touchEnd(env.window, element, 220);
    assert.equal(destinations[1], "/");
    assert.ok(
      animations[0].cancelled > 0,
      "old settling animation was cancelled at the next touchstart",
    );
    cleanup();
  } finally {
    env.restore();
  }
});

test("pending navigation can be reversed using its logical destination; stale completion preserves new visuals", async () => {
  const env = setup();
  try {
    const { element } = createSurface();
    const firstNavigation = deferred<void>();
    const destinations: string[] = [];
    const cleanup = installModuleSwipeGesture(element, {
      getPathname: () => "/",
      navigate: (destination) => {
        destinations.push(destination);
        return destinations.length === 1 ? firstNavigation.promise : Promise.resolve();
      },
    });
    touchStart(env.window, element, 200);
    touchMove(env.window, element, 100);
    env.window.flushFrames();
    touchEnd(env.window, element, 100);
    touchStart(env.window, element, 100);
    touchMove(env.window, element, 220);
    env.window.flushFrames();
    touchEnd(env.window, element, 220);
    assert.deepEqual(
      destinations,
      ["/ai", "/"],
      "the second route is computed from pending /ai, not stale / location",
    );
    assert.equal(element.style.transform, "translate3d(20px, 0, 0)");
    firstNavigation.resolve();
    await settleMicrotasks();
    assert.equal(
      element.style.transform,
      "translate3d(20px, 0, 0)",
      "the stale route completion must not clear the new transition",
    );
    cleanup();
  } finally {
    env.restore();
  }
});

test("vertical movement, short cancellation and touchcancel release drag and cancel queued frames", () => {
  const env = setup();
  try {
    const { element, animations } = createSurface();
    const cleanup = installModuleSwipeGesture(element, {
      getPathname: () => "/",
      navigate: async () => assert.fail("cancelled gestures must not navigate"),
    });

    touchStart(env.window, element, 200);
    touchMove(env.window, element, 210, 130);
    assert.equal(env.window.frames.size, 0, "vertical intent cancels before scheduling a write");
    assert.equal(element.style.transform, "");

    touchStart(env.window, element, 200);
    touchMove(env.window, element, 175);
    env.window.flushFrames();
    touchEnd(env.window, element, 175);
    assert.equal(element.style.transform, "");
    assert.equal(animations.at(-1)?.options.duration, 140, "short drag snaps back");

    touchStart(env.window, element, 200);
    touchMove(env.window, element, 160);
    assert.equal(env.window.frames.size, 1);
    env.window.dispatch("touchcancel");
    assert.equal(env.window.frames.size, 0);
    assert.equal(element.style.transform, "");
    cleanup();
  } finally {
    env.restore();
  }
});

test("interactive targets, horizontal nested scrollers, modal overlays and browser edges are ignored", () => {
  const env = setup();
  try {
    const { element } = createSurface();
    const navigate = async () => assert.fail("blocked input must not navigate");
    const cleanup = installModuleSwipeGesture(element, { getPathname: () => "/", navigate });
    const interactive = new FakeElement("button");
    interactive.blocked = true;
    touchStart(env.window, interactive as unknown as EventTarget, 200);
    touchMove(env.window, interactive as unknown as EventTarget, 100);
    env.window.flushFrames();
    touchEnd(env.window, interactive as unknown as EventTarget, 100);
    assert.equal(element.style.transform, "");

    const scroller = new FakeElement("horizontal scroller");
    scroller.scrollWidth = 600;
    scroller.overflowX = "auto";
    touchStart(env.window, scroller as unknown as EventTarget, 200);
    touchMove(env.window, scroller as unknown as EventTarget, 100);
    env.window.flushFrames();
    assert.equal(element.style.transform, "");
    touchEnd(env.window, scroller as unknown as EventTarget, 100);

    env.setModal(true);
    touchStart(env.window, element, 200);
    touchMove(env.window, element, 100);
    env.window.flushFrames();
    touchEnd(env.window, element, 100);
    env.setModal(false);

    touchStart(env.window, element, 5);
    touchMove(env.window, element, 100);
    env.window.flushFrames();
    touchEnd(env.window, element, 100);
    touchStart(env.window, element, 395);
    touchMove(env.window, element, 300);
    env.window.flushFrames();
    touchEnd(env.window, element, 300);

    env.window.dispatch("pointerdown", { pointerType: "mouse", clientX: 200, clientY: 100 });
    assert.equal(element.style.transform, "");
    cleanup();
  } finally {
    env.restore();
  }
});

test("reduced motion avoids drag writes; cleanup removes stable listeners and frames", () => {
  const env = setup(true);
  try {
    const { element, animations } = createSurface();
    let calls = 0;
    const cleanup = installModuleSwipeGesture(element, {
      getPathname: () => "/",
      navigate: async () => void calls++,
    });
    touchStart(env.window, element, 200);
    touchMove(env.window, element, 100);
    env.window.flushFrames();
    assert.equal(element.style.transform, "");
    touchEnd(env.window, element, 100);
    assert.equal(calls, 1);
    assert.equal(animations.length, 0);
    cleanup();
    for (const type of ["touchstart", "touchmove", "touchend", "touchcancel"])
      assert.equal(env.window.listeners.get(type)?.size, 0);
    assert.equal(env.window.frames.size, 0);
    assert.equal(element.style.transform, "");
  } finally {
    env.restore();
  }
});

test("reduced motion keeps the surface still through a delayed navigation", async () => {
  const env = setup(true);
  try {
    const { element, animations } = createSurface();
    const navigation = deferred<void>();
    const cleanup = installModuleSwipeGesture(element, {
      getPathname: () => "/",
      navigate: () => navigation.promise,
    });
    touchStart(env.window, element, 200);
    touchMove(env.window, element, 100);
    env.window.flushFrames();
    touchEnd(env.window, element, 100);
    assert.equal(element.style.transform, "");
    assert.equal(element.style.willChange, "");
    assert.equal(animations.length, 0);
    navigation.resolve();
    await settleMicrotasks();
    assert.equal(element.style.transform, "");
    cleanup();
  } finally {
    env.restore();
  }
});

test("a control tap during settling leaves the animation running instead of freezing its offset", () => {
  const env = setup();
  try {
    const { element, animations } = createSurface();
    const cleanup = installModuleSwipeGesture(element, {
      getPathname: () => "/ai",
      navigate: async () => undefined,
    });
    touchStart(env.window, element, 200);
    touchMove(env.window, element, 100);
    env.window.flushFrames();
    touchEnd(env.window, element, 100);
    const control = new FakeElement("button");
    control.blocked = true;
    touchStart(env.window, control as unknown as EventTarget, 200);
    touchEnd(env.window, control as unknown as EventTarget, 200);
    assert.equal(animations[0].cancelled, 0, "controls must not interrupt visual settling");
    assert.equal(animations.length, 1);
    cleanup();
  } finally {
    env.restore();
  }
});
