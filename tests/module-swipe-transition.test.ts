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
  const documentMock: {
    documentElement: { dataset: typeof dataset };
    startViewTransition?: (update: () => Promise<void>) => unknown;
  } = { documentElement: { dataset } };
  const originals = ["window", "document"].map(
    (key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const,
  );
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { matchMedia: () => ({ matches: reducedMotion }) },
  });
  Object.defineProperty(globalThis, "document", { configurable: true, value: documentMock });
  return {
    document: documentMock,
    dataset,
    restore: () => {
      for (const [key, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
    },
  };
}

function surface(animate?: (...args: unknown[]) => unknown) {
  return { isConnected: true, animate } as unknown as HTMLElement;
}

for (const direction of ["left", "right"] as const) {
  test(`native ${direction} transition navigates exactly once and clears its marker`, async () => {
    const env = environment();
    try {
      let navigations = 0;
      let snapshots = 0;
      env.document.startViewTransition = (update) => {
        snapshots++;
        assert.equal(env.dataset.moduleSwipe, direction);
        return { finished: update(), skipTransition() {} };
      };
      await startModuleSwipeTransition(surface(), direction, async () => {
        navigations++;
      }).finished;
      assert.equal(navigations, 1);
      assert.equal(snapshots, 1);
      assert.equal(env.dataset.moduleSwipe, undefined);
    } finally {
      env.restore();
    }
  });

  test(`fallback ${direction} entrance has the right direction and cleans up`, async () => {
    const env = environment();
    try {
      let navigations = 0;
      let cancelled = 0;
      const element = surface((frames, options) => {
        assert.equal(navigations, 1, "navigation is never delayed by the fallback");
        assert.equal(
          (frames as Keyframe[])[0].transform,
          `translateX(${direction === "left" ? "100%" : "-100%"})`,
        );
        assert.equal((options as KeyframeAnimationOptions).duration, 380);
        return {
          finished: Promise.resolve(),
          cancel() {
            cancelled++;
          },
        };
      });
      await startModuleSwipeTransition(element, direction, async () => {
        navigations++;
      }).finished;
      assert.equal(cancelled, 1);
      assert.equal(env.dataset.moduleSwipe, undefined);
    } finally {
      env.restore();
    }
  });
}

test("reduced motion and missing surfaces navigate immediately without animation", async () => {
  for (const reduced of [true, false]) {
    const env = environment(reduced);
    try {
      env.document.startViewTransition = () => {
        throw Error("must not animate");
      };
      let navigations = 0;
      await startModuleSwipeTransition(reduced ? surface() : null, "left", async () => {
        navigations++;
      }).finished;
      assert.equal(navigations, 1);
      assert.equal(env.dataset.moduleSwipe, undefined);
    } finally {
      env.restore();
    }
  }
});

test("a rejected or unavailable native snapshot never loses or repeats navigation", async () => {
  for (const mode of ["throw", "reject"] as const) {
    const env = environment();
    try {
      let navigations = 0;
      env.document.startViewTransition = () => {
        if (mode === "throw") throw Error("snapshot unavailable");
        return { finished: Promise.reject(Error("snapshot skipped")), skipTransition() {} };
      };
      await startModuleSwipeTransition(surface(), "left", async () => {
        navigations++;
      }).finished;
      assert.equal(navigations, 1);
      assert.equal(env.dataset.moduleSwipe, undefined);
    } finally {
      env.restore();
    }
  }
});

test("route failures are reported and always clear transition state", async () => {
  const env = environment();
  try {
    env.document.startViewTransition = (update) => ({ finished: update(), skipTransition() {} });
    await assert.rejects(
      startModuleSwipeTransition(surface(), "right", async () => {
        throw Error("route failed");
      }).finished,
      /route failed/,
    );
    assert.equal(env.dataset.moduleSwipe, undefined);
  } finally {
    env.restore();
  }
});

test("unmount cancellation skips native snapshots and suppresses a late fallback", async () => {
  const env = environment();
  try {
    let resolveNavigation!: () => void;
    const navigation = new Promise<void>((resolve) => {
      resolveNavigation = resolve;
    });
    let animated = false;
    const fallback = startModuleSwipeTransition(
      surface(() => {
        animated = true;
      }),
      "left",
      () => navigation,
    );
    fallback.cancel();
    resolveNavigation();
    await fallback.finished;
    assert.equal(animated, false);

    let skipped = false;
    env.document.startViewTransition = (update) => ({
      finished: update(),
      skipTransition() {
        skipped = true;
      },
    });
    const native = startModuleSwipeTransition(surface(), "right", async () => {});
    native.cancel();
    await native.finished;
    assert.equal(skipped, true);
    assert.equal(env.dataset.moduleSwipe, undefined);
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
  assert.equal(moduleFromPath("/profile"), null, "settings is not a product module");
  assert.equal(swipeScreenFromPath("/profile"), "/profile");
  assert.equal(ALO_MODULES.length, 3);
  assert.equal(ALO_SWIPE_SCREENS.length, 4);
  assert.equal(getSwipeDestination("/coach", -72, 0), "/chat");
  assert.equal(getSwipeDestination("/coach", 72, 0), "/");
  assert.equal(getSwipeDestination("/", -71.9, 0), null);
  assert.equal(getSwipeDestination("/", -72, 0), "/ai");
  for (const path of ["/profile", "/settings", "/workout/one", "/cali-workout/one"]) {
    assert.equal(getSwipeDestination(path, -120, 0), null);
  }
  assert.equal(getSwipeDestination("/ai", -120, 0, true), null);
  assert.equal(getSwipeDestination("/ai", -120, 120), null);
});

test("the outlet alone animates; rapid swipes, reduced motion and existing guards are preserved", () => {
  const read = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
  const layout = read("routes/_authenticated/route.tsx");
  const css = read("module-swipe.css");
  assert.match(layout, /if \(swipeTransition.current\)/);
  assert.match(layout, /swipeTransition.current\?\.cancel\(\)/);
  assert.match(layout, /className="alo-module-surface">\s*<Outlet \/>/);
  assert.match(layout, /parent.scrollWidth > parent.clientWidth \+ 4/);
  assert.match(layout, /passive: true/);
  assert.doesNotMatch(layout, /preventDefault\(/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(css, /\.authenticated-shell/);
  assert.match(read("routes/__root.tsx"), /swipeScreenFromPath\(pathname\) \? "alo-swipe-screens"/);
  assert.match(read("components/TopNav.tsx"), /aria-label="Einstellungen und Profil"/);
  for (const direction of ["left", "right"]) {
    assert.ok(css.includes(`alo-swipe-in-${direction}`));
    assert.ok(css.includes(`alo-swipe-out-${direction}`));
  }
});

test("compact menu releases its space after two seconds, returns on navigation and protects keyboard focus", () => {
  const read = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
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

test("skipped native ready promises are handled without unhandled rejections", async () => {
  const env = environment();
  try {
    let navigations = 0;
    env.document.startViewTransition = (update) => ({
      ready: Promise.reject(Error("snapshot skipped")),
      finished: update(),
      skipTransition() {},
    });
    await startModuleSwipeTransition(surface(), "left", async () => {
      navigations++;
    }).finished;
    assert.equal(navigations, 1);
    assert.equal(env.dataset.moduleSwipe, undefined);
  } finally {
    env.restore();
  }
});

for (const failure of ["throw", "ready", "finished"] as const) {
  test(`native ${failure} failure uses a visible full-width fallback exactly once`, async () => {
    const env = environment();
    try {
      let navigations = 0;
      let animations = 0;
      env.document.startViewTransition = (update) => {
        if (failure === "throw") throw Error("unavailable");
        return {
          ready: failure === "ready" ? Promise.reject(Error("skipped")) : Promise.resolve(),
          finished: failure === "finished" ? Promise.reject(Error("skipped")) : update(),
          skipTransition() {},
        };
      };
      const element = surface((frames, options) => {
        animations++;
        assert.equal(navigations, 1);
        assert.equal((frames as Keyframe[])[0].transform, "translateX(100%)");
        assert.equal((options as KeyframeAnimationOptions).duration, 380);
        return { finished: Promise.resolve(), cancel() {} };
      });
      await startModuleSwipeTransition(element, "left", async () => {
        navigations++;
      }).finished;
      assert.equal(navigations, 1);
      assert.equal(animations, 1);
      assert.equal(env.dataset.moduleSwipe, undefined);
    } finally {
      env.restore();
    }
  });
}

test("the stable swipe shell cannot restart the generic route entrance after cleanup", () => {
  const root = readFileSync(new URL("../src/routes/__root.tsx", import.meta.url), "utf8");
  assert.match(root, /routeKey === "alo-swipe-screens" \? "alo-swipe-route" : "route-enter"/);
});
