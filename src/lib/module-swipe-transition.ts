export type ModuleSwipeDirection = "left" | "right";

interface SwipeTransition {
  finished: Promise<void>;
  ready?: Promise<void>;
  skipTransition(): void;
}

type TransitionDocument = Document & {
  startViewTransition?: (update: () => Promise<void>) => SwipeTransition;
};

/** Animate only deliberate module swipes, never ordinary links or initial loads. */
export function startModuleSwipeTransition(
  surface: HTMLElement | null,
  direction: ModuleSwipeDirection,
  navigate: () => Promise<void>,
): { finished: Promise<void>; cancel: () => void } {
  const root = document.documentElement;
  let cancelled = false;
  let transition: SwipeTransition | undefined;
  let animation: Animation | undefined;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const cancel = () => {
    cancelled = true;
    transition?.skipTransition();
    animation?.cancel();
  };

  const animateEntrance = async () => {
    if (cancelled || !surface?.isConnected || typeof surface.animate !== "function") return;
    animation = surface.animate(
      [
        { transform: `translateX(${direction === "left" ? "100%" : "-100%"})` },
        { transform: "translateX(0)" },
      ],
      { duration: 380, easing: "cubic-bezier(0.4, 0, 0.2, 1)" },
    );
    await animation.finished.catch(() => undefined);
    animation.cancel();
  };

  const finished = (async () => {
    if (reducedMotion || !surface) {
      await navigate();
      return;
    }

    const transitionDocument = document as TransitionDocument;
    if (typeof transitionDocument.startViewTransition === "function") {
      root.dataset.moduleSwipe = direction;
      // Keep the old screen as a snapshot, not a second live chat/workout instance.
      let navigation: Promise<void> | undefined;
      const update = () => (navigation ??= navigate());
      let snapshotReady = true;
      try {
        try {
          transition = transitionDocument.startViewTransition(update);
          // A supported API can still skip a snapshot. In that case animate the
          // committed surface instead of silently dropping all visual feedback.
          const ready = transition.ready?.catch(() => {
            snapshotReady = false;
          });
          await transition.finished.catch(() => {
            snapshotReady = false;
          });
          await ready;
        } catch {
          snapshotReady = false;
        }
        await update();
        if (!snapshotReady) await animateEntrance();
      } finally {
        delete root.dataset.moduleSwipe;
      }
      return;
    }

    // Older browsers get the same full-width entrance, without delaying routing.
    await navigate();
    await animateEntrance();
  })();

  return { finished, cancel };
}
