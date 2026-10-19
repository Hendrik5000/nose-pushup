import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { startModuleSwipeTransition } from "../src/lib/module-swipe-transition";
import {
  ALO_MODULES,
  ALO_SWIPE_SCREENS,
  getSwipeDestination,
  moduleFromPath,
  swipeScreenFromPath,
} from "../src/lib/module-navigation";

function environment(reducedMotion = false) {
  const dataset: Record<string, string> = {};
  const originals = ["window", "document"].map(
    (key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const,
  );
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { innerWidth: 400, matchMedia: () => ({ matches: reducedMotion }) },
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      documentElement: { dataset },
      startViewTransition() {
        throw Error("Expensive snapshots must never be used");
      },
    },
  });
  return {
    dataset,
    restore() {
      for (const [key, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
    },
  };
}
function surface(animate?: (...args: unknown[]) => unknown) {
  return {
    isConnected: true,
    style: { transform: "", willChange: "" },
    animate,
  } as unknown as HTMLElement;
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
for (const direction of ["left", "right"] as const) {
  test(`${direction}: feedback starts before navigation; entrance is directional and compositor-only`, async () => {
    const env = environment();
    try {
      let navigations = 0;
      const calls: { frames: Keyframe[]; options: KeyframeAnimationOptions }[] = [];
      const element = surface((frames, options) => {
        calls.push({ frames: frames as Keyframe[], options: options as KeyframeAnimationOptions });
        assert.equal(navigations, calls.length === 1 ? 0 : 1);
        return { finished: Promise.resolve(), cancel() {} };
      });
      await startModuleSwipeTransition(
        element,
        direction,
        async () => {
          navigations++;
        },
        direction === "left" ? -80 : 80,
      ).finished;
      assert.equal(navigations, 1);
      assert.equal(calls.length, 2);
      assert.equal(
        calls[0].frames[0].transform,
        `translate3d(${direction === "left" ? -80 : 80}px, 0, 0)`,
      );
      assert.equal(
        calls[1].frames[0].transform,
        `translate3d(${direction === "left" ? "100%" : "-100%"}, 0, 0)`,
      );
      assert.equal(calls[1].options.duration, 260);
      assert.ok(
        calls.every((call) =>
          call.frames.every((frame) => Object.keys(frame).every((key) => key === "transform")),
        ),
      );
      assert.equal(element.style.transform, "");
      assert.equal(element.style.willChange, "");
      assert.equal(env.dataset.moduleSwipe, undefined);
    } finally {
      env.restore();
    }
  });
}
test("slow routing never delays initial feedback or waits for the outgoing animation", async () => {
  const env = environment();
  try {
    const navigation = deferred();
    const neverFinished = deferred();
    let animations = 0;
    let navigations = 0;
    const element = surface(() => {
      animations++;
      return {
        finished: animations === 1 ? neverFinished.promise : Promise.resolve(),
        cancel() {},
      };
    });
    const transition = startModuleSwipeTransition(element, "left", () => {
      navigations++;
      return navigation.promise;
    });
    assert.equal(
      animations,
      1,
      "feedback is synchronous even while the destination is still loading",
    );
    assert.equal(navigations, 1);
    navigation.resolve();
    await transition.finished;
    assert.equal(animations, 2, "navigation and outgoing feedback run in parallel");
  } finally {
    env.restore();
  }
});
test("reduced motion, missing surfaces and missing WAAPI navigate once without animation", async () => {
  for (const mode of ["reduced", "missing", "unsupported"] as const) {
    const env = environment(mode === "reduced");
    try {
      let navigations = 0;
      const element =
        mode === "missing"
          ? null
          : surface(
              mode === "reduced"
                ? () => {
                    throw Error("must not animate");
                  }
                : undefined,
            );
      await startModuleSwipeTransition(element, "left", async () => {
        navigations++;
      }).finished;
      assert.equal(navigations, 1);
      assert.equal(env.dataset.moduleSwipe, undefined);
    } finally {
      env.restore();
    }
  }
});
test("animation API failures cannot suppress or duplicate navigation", async () => {
  const env = environment();
  try {
    let navigations = 0;
    await startModuleSwipeTransition(
      surface(() => {
        throw Error("animation unavailable");
      }),
      "left",
      async () => {
        navigations++;
      },
    ).finished;
    assert.equal(navigations, 1);
    assert.equal(env.dataset.moduleSwipe, undefined);
  } finally {
    env.restore();
  }
});
test("route errors propagate and release all gesture state", async () => {
  const env = environment();
  try {
    const element = surface(() => ({ finished: Promise.resolve(), cancel() {} }));
    await assert.rejects(
      startModuleSwipeTransition(element, "right", async () => {
        throw Error("route failed");
      }).finished,
      /route failed/,
    );
    assert.equal(element.style.transform, "");
    assert.equal(element.style.willChange, "");
    assert.equal(env.dataset.moduleSwipe, undefined);
  } finally {
    env.restore();
  }
});
test("unmount cancellation releases the layer and suppresses a late entrance", async () => {
  const env = environment();
  try {
    const navigation = deferred();
    let animations = 0;
    let cancelled = 0;
    const element = surface(() => {
      animations++;
      return {
        finished: Promise.resolve(),
        cancel() {
          cancelled++;
        },
      };
    });
    const transition = startModuleSwipeTransition(element, "left", () => navigation.promise);
    transition.cancel();
    assert.equal(element.style.willChange, "");
    navigation.resolve();
    await transition.finished;
    assert.equal(animations, 1);
    assert.ok(cancelled >= 1);
    assert.equal(env.dataset.moduleSwipe, undefined);
  } finally {
    env.restore();
  }
});
test("a disconnected destination is not animated", async () => {
  const env = environment();
  try {
    let animations = 0;
    const element = surface(() => {
      animations++;
      return { finished: Promise.resolve(), cancel() {} };
    });
    await startModuleSwipeTransition(element, "left", async () => {
      Object.defineProperty(element, "isConnected", { value: false });
    }).finished;
    assert.equal(animations, 1);
  } finally {
    env.restore();
  }
});

test("swipe boundaries, aliases, exact threshold and protected routes remain unchanged", () => {
  assert.equal(getSwipeDestination("/", 100, 0), null);
  assert.equal(getSwipeDestination("/chat", -100, 0), "/profile");
  assert.equal(getSwipeDestination("/profile", 100, 0), "/chat");
  assert.equal(getSwipeDestination("/profile", -100, 0), null);
  assert.equal(getSwipeDestination("/profile", 100, 0, true), null);
  assert.equal(moduleFromPath("/profile"), null);
  assert.equal(swipeScreenFromPath("/profile"), "/profile");
  assert.equal(ALO_MODULES.length, 3);
  assert.equal(ALO_SWIPE_SCREENS.length, 4);
  assert.equal(getSwipeDestination("/coach", -72, 0), "/chat");
  assert.equal(getSwipeDestination("/coach", 72, 0), "/");
  assert.equal(getSwipeDestination("/", -71.9, 0), null);
  assert.equal(getSwipeDestination("/", -72, 0), "/ai");
  for (const path of ["/profile", "/settings", "/workout/one", "/cali-workout/one"])
    assert.equal(getSwipeDestination(path, -120, 0), null);
  assert.equal(getSwipeDestination("/ai", -120, 0, true), null);
  assert.equal(getSwipeDestination("/ai", -120, 120), null);
});
const read = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
test("direct touch tracking is frame-batched and all native gesture guards remain", () => {
  const layout = read("routes/_authenticated/route.tsx");
  assert.match(layout, /if \(swipeTransition.current\)/);
  assert.match(layout, /swipeTransition.current\?\.cancel\(\)/);
  assert.match(layout, /className="alo-module-surface">\s*<Outlet \/>/);
  assert.match(layout, /parent.scrollWidth > parent.clientWidth \+ 4/);
  assert.match(layout, /passive: true/);
  assert.match(layout, /addEventListener\("touchmove", touchMove/);
  assert.match(layout, /removeEventListener\("touchmove", touchMove/);
  assert.match(layout, /requestAnimationFrame/);
  assert.match(layout, /cancelAnimationFrame/);
  assert.match(layout, /Math.abs\(dy\) > 10/);
  assert.match(layout, /reducedMotion/);
  assert.doesNotMatch(layout, /preventDefault\(/);
  assert.doesNotMatch(layout, /touch-action:/);
  assert.doesNotMatch(read("lib/module-swipe-transition.ts"), /startViewTransition/);
  assert.match(read("module-swipe.css"), /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(read("module-swipe.css"), /view-transition/);
  assert.doesNotMatch(read("module-swipe.css"), /\.authenticated-shell/);
  assert.match(
    read("routes/__root.tsx"),
    /routeKey === "alo-swipe-screens" \? "alo-swipe-route" : "route-enter"/,
  );
});
test("compact menu retains two-second hiding, upward reflow and keyboard focus protection", () => {
  const hook = read("hooks/useAutoHideModuleMenu.ts");
  const nav = read("components/TopNav.tsx");
  const css = read("module-menu.css");
  assert.match(hook, /MODULE_MENU_IDLE_MS = 2_000/);
  assert.match(hook, /moduleMenuVisible = "false"/);
  assert.match(hook, /\[pathname, reveal\]/);
  assert.match(hook, /matches\(":focus-visible"\)/);
  assert.match(hook, /clearTimeout\(timer.current\)/);
  assert.match(hook, /removeEventListener\("pointermove", pointer\)/);
  assert.match(hook, /removeEventListener\("touchstart", touch\)/);
  assert.match(nav, /onFocusCapture=\{moduleMenu.reveal\}/);
  assert.match(nav, /onBlurCapture=\{moduleMenu.scheduleHide\}/);
  assert.match(css, /pointer-events: none/);
  assert.match(css, /--homebar-top-space: env\(safe-area-inset-top, 0px\) !important/);
  assert.match(css, /data-navigation-expanded="true"/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(read("components/SportAppHeader.tsx"), /aria-label="Design & Navigation öffnen"/);
});
