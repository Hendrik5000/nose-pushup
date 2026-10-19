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

  const finished = (async () => {
    if (reducedMotion || !surface) {
      await navigate();
      return;
    }

    const transitionDocument = document as TransitionDocument;
    if (typeof transitionDocument.startViewTransition === "function") {
      root.dataset.moduleSwipe = direction;
      // The router promise resolves after the new route is committed. Snapshots
      // avoid keeping old chat/training components mounted during the animation.
      let navigation: Promise<void> | undefined;
      const update = () => (navigation ??= navigate());
      try {
        try {
          transition = transitionDocument.startViewTransition(update);
          // ready rejects on skipped snapshots, independently of finished.
          void transition.ready?.catch(() => undefined);
        } catch {
          // A browser animation failure must never prevent navigation.
          await update();
          return;
        }
        await transition.finished.catch(() => undefined);
        await update();
      } finally {
        delete root.dataset.moduleSwipe;
      }
      return;
    }

    // Older browsers still get a directional entrance, without delaying routing.
    await navigate();
    if (!cancelled && surface.isConnected && typeof surface.animate === "function") {
      animation = surface.animate(
        [
          { transform: `translateX(${direction === "left" ? "8%" : "-8%"})`, opacity: 0.65 },
          { transform: "translateX(0)", opacity: 1 },
        ],
        { duration: 240, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
      );
      await animation.finished.catch(() => undefined);
      animation.cancel();
    }
  })();

  return { finished, cancel };
}
