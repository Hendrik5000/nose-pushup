export type ModuleSwipeDirection = "left" | "right";

/** Settle the finger's actual position while routing, without a second full-screen entrance. */
export function startModuleSwipeTransition(
  surface: HTMLElement | null,
  direction: ModuleSwipeDirection,
  navigate: () => Promise<void>,
  dragOffset = 0,
): { finished: Promise<void>; cancel: () => void; readonly navigating: boolean } {
  const root = document.documentElement;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let navigating = true;
  let animation: Animation | undefined;
  const clear = () => {
    animation?.cancel();
    if (surface) {
      surface.style.transform = "";
      surface.style.willChange = "";
    }
    delete root.dataset.moduleSwipe;
  };
  // A late navigation completion must not clear a newer gesture's transform.
  let cancelled = false;
  const cancel = () => {
    if (cancelled) return;
    cancelled = true;
    clear();
  };
  const finished = (async () => {
    let settling = Promise.resolve();
    if (!reducedMotion && surface?.isConnected && typeof surface.animate === "function") {
      root.dataset.moduleSwipe = direction;
      surface.style.willChange = "transform";
      try {
        animation = surface.animate(
          [
            { transform: `translate3d(${dragOffset}px, 0, 0)` },
            { transform: "translate3d(0, 0, 0)" },
          ],
          { duration: 160, easing: "ease-out", fill: "forwards" },
        );
        settling = animation.finished.then(
          () => undefined,
          () => undefined,
        );
      } catch {
        // Rendering the destination is more important than visual feedback.
      }
    }
    try {
      // Auth/chunk loading and settling run concurrently, not as serial phases.
      // The controller can interrupt settling as soon as navigation completes.
      try {
        await navigate();
      } finally {
        navigating = false;
      }
      await settling;
    } finally {
      if (!cancelled) clear();
    }
  })();
  return {
    finished,
    cancel,
    get navigating() {
      return navigating;
    },
  };
}
