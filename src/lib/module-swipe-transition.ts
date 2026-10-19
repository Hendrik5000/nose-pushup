export type ModuleSwipeDirection = "left" | "right";

/** Compositor-only feedback starts before routing; no full-page snapshots or freezes. */
export function startModuleSwipeTransition(
  surface: HTMLElement | null,
  direction: ModuleSwipeDirection,
  navigate: () => Promise<void>,
  dragOffset = 0,
): { finished: Promise<void>; cancel: () => void } {
  const root = document.documentElement;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let cancelled = false;
  let outgoing: Animation | undefined;
  let incoming: Animation | undefined;
  const clear = () => {
    outgoing?.cancel();
    incoming?.cancel();
    if (surface) {
      surface.style.transform = "";
      surface.style.willChange = "";
    }
    delete root.dataset.moduleSwipe;
  };
  const cancel = () => {
    cancelled = true;
    clear();
  };
  const finished = (async () => {
    if (reducedMotion || !surface || typeof surface.animate !== "function") {
      try {
        await navigate();
      } finally {
        clear();
      }
      return;
    }
    root.dataset.moduleSwipe = direction;
    surface.style.willChange = "transform";
    try {
      // Start visible feedback immediately, in parallel with auth/chunk loading.
      // Keep the old route alive until the router commits; never duplicate modules.
      const sign = direction === "left" ? -1 : 1;
      try {
        outgoing = surface.animate(
          [
            { transform: `translate3d(${dragOffset}px, 0, 0)` },
            {
              transform: `translate3d(${sign * Math.max(Math.abs(dragOffset), window.innerWidth * 0.32)}px, 0, 0)`,
            },
          ],
          { duration: 120, easing: "ease-out", fill: "forwards" },
        );
        void outgoing.finished.catch(() => undefined);
      } catch {
        // An animation failure must never prevent navigation.
      }
      await navigate();
      outgoing?.cancel();
      if (cancelled || !surface.isConnected) return;
      surface.style.transform = "";
      try {
        incoming = surface.animate(
          [
            { transform: `translate3d(${direction === "left" ? "100%" : "-100%"}, 0, 0)` },
            { transform: "translate3d(0, 0, 0)" },
          ],
          { duration: 260, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
        );
        await incoming.finished.catch(() => undefined);
      } catch {
        // Rendering the destination is more important than visual feedback.
      }
    } finally {
      clear();
    }
  })();
  return { finished, cancel };
}
