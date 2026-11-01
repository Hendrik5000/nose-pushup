import { getSwipeDestination, isModuleSwipeBlocked, type AloSwipeRoute } from "./module-navigation";
import { startModuleSwipeTransition } from "./module-swipe-transition";

export interface ModuleSwipeGestureOptions {
  getPathname: () => string;
  navigate: (destination: AloSwipeRoute) => Promise<void>;
}

interface SwipeTransitionHandle {
  readonly navigating: boolean;
  finished: Promise<void>;
  cancel: () => void;
}

/** Install touch-only module navigation once; route changes are read lazily from options. */
export function installModuleSwipeGesture(
  surface: HTMLElement,
  options: ModuleSwipeGestureOptions,
): () => void {
  const win = window;
  let start: { x: number; y: number; target: EventTarget | null } | null = null;
  let dragX = 0;
  let appliedX = 0;
  let gestureBaseX = 0;
  let gesturePath = "";
  let frame = 0;
  let reducedMotion = false;
  let snapBack: Animation | undefined;
  let transition: SwipeTransitionHandle | null = null;
  let routingDestination: AloSwipeRoute | null = null;
  let scrollBlocked: boolean | undefined;

  const stopFrame = () => {
    if (frame) win.cancelAnimationFrame(frame);
    frame = 0;
  };
  const cancelSnapBack = () => {
    snapBack?.cancel();
    snapBack = undefined;
  };
  const writeOffset = (offset: number) => {
    surface.style.willChange = "transform";
    surface.style.transform = `translate3d(${offset}px, 0, 0)`;
    appliedX = offset;
  };
  const readVisualOffset = () => {
    const value = getComputedStyle(surface).transform;
    const matrix3d = value.match(/^matrix3d\(([^)]+)\)$/);
    if (matrix3d) return Number(matrix3d[1].split(",")[12]) || 0;
    const matrix = value.match(/^matrix\(([^)]+)\)$/);
    if (matrix) return Number(matrix[1].split(",")[4]) || 0;
    const translated =
      value.match(/translate3d\(\s*(-?[\d.]+)px/i) ?? value.match(/translateX\(\s*(-?[\d.]+)px/i);
    return translated ? Number(translated[1]) || 0 : 0;
  };
  const resetDrag = (animateBack = true) => {
    stopFrame();
    const transform = surface.style.transform;
    dragX = 0;
    appliedX = 0;
    cancelSnapBack();
    surface.style.transform = "";
    surface.style.willChange = "";
    if (animateBack && transform && !reducedMotion && typeof surface.animate === "function") {
      try {
        const animation = surface.animate([{ transform }, { transform: "translate3d(0, 0, 0)" }], {
          duration: 140,
          easing: "ease-out",
        });
        snapBack = animation;
        void animation.finished
          .catch(() => undefined)
          .finally(() => {
            animation.cancel();
            if (snapBack === animation) snapBack = undefined;
          });
      } catch {
        // The inline transform was already cleared; gesture recovery must not depend on WAAPI.
      }
    }
  };
  const cancelGesture = () => {
    start = null;
    resetDrag();
  };
  const hasNestedScroller = (target: EventTarget | null) => {
    if (scrollBlocked !== undefined) return scrollBlocked;
    const element = target instanceof Element ? target.closest<HTMLElement>("*") : null;
    for (let parent = element; parent; parent = parent.parentElement) {
      if (parent.scrollWidth > parent.clientWidth + 4) {
        const style = getComputedStyle(parent);
        if (style.overflowX === "auto" || style.overflowX === "scroll") {
          return (scrollBlocked = true);
        }
      }
    }
    return (scrollBlocked = false);
  };
  const down = (event: TouchEvent) => {
    start = null;
    const touch = event.touches[0];
    if (!touch || event.touches.length !== 1) return cancelGesture();
    const activeTransition = transition;
    const navigationIsPending = activeTransition?.navigating === true;
    gesturePath =
      navigationIsPending && routingDestination ? routingDestination : options.getPathname();
    // A tap on a control must not freeze an interrupted animation at a nonzero offset.
    if (document.querySelector('[aria-modal="true"], [role="dialog"], #sport-area-menu')) return;
    if (touch.clientX < 24 || touch.clientX > win.innerWidth - 24) return;
    if (isModuleSwipeBlocked(event.target, gesturePath)) return;
    reducedMotion = win.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const currentOffset = reducedMotion ? 0 : readVisualOffset();
    if (transition) {
      // Cancel visual feedback immediately, even while router navigation is pending.
      // Keep the handle until it settles if its logical route is still being loaded.
      transition.cancel();
      if (!navigationIsPending) transition = null;
    }
    start = null;
    cancelSnapBack();
    resetDrag(false);
    gestureBaseX = currentOffset;
    if (gestureBaseX) writeOffset(gestureBaseX);
    scrollBlocked = undefined;
    start = { x: touch.clientX, y: touch.clientY, target: event.target };
  };
  const move = (event: TouchEvent) => {
    if (!start) return;
    if (event.touches.length !== 1) return cancelGesture();
    const touch = event.touches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx) / 1.35) return cancelGesture();
    if (Math.abs(dx) < 8 || reducedMotion) return;
    if (hasNestedScroller(start.target)) return cancelGesture();
    if (!getSwipeDestination(gesturePath, Math.sign(dx) * 72, 0)) return resetDrag();
    cancelSnapBack();
    dragX = Math.max(-win.innerWidth * 0.6, Math.min(win.innerWidth * 0.6, gestureBaseX + dx));
    if (!frame) {
      frame = win.requestAnimationFrame(() => {
        frame = 0;
        if (!start) return;
        writeOffset(dragX);
      });
    }
  };
  const up = (event: TouchEvent) => {
    if (!start) return;
    if (event.touches.length || event.changedTouches.length !== 1) return cancelGesture();
    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    const pathname = gesturePath;
    const blocked =
      isModuleSwipeBlocked(start.target, pathname) ||
      isModuleSwipeBlocked(event.target, pathname) ||
      hasNestedScroller(start.target);
    const destination = getSwipeDestination(pathname, dx, dy, blocked);
    start = null;
    if (destination) {
      // Flush the latest release position before handing off; the transition starts from
      // the actual visible offset, never from a move still waiting in the RAF queue.
      stopFrame();
      if (!reducedMotion) {
        const finalX = Math.max(
          -win.innerWidth * 0.6,
          Math.min(win.innerWidth * 0.6, gestureBaseX + dx),
        );
        writeOffset(finalX);
      }
      const direction = dx < 0 ? "left" : "right";
      routingDestination = destination;
      const handle = startModuleSwipeTransition(
        surface,
        direction,
        () => options.navigate(destination),
        appliedX,
      ) as SwipeTransitionHandle;
      transition = handle;
      dragX = 0;
      appliedX = 0;
      void handle.finished
        .catch((error: unknown) => console.error("Alo module swipe navigation failed", error))
        .finally(() => {
          if (transition === handle) {
            transition = null;
            if (!handle.navigating) routingDestination = null;
          }
        });
    } else {
      resetDrag();
    }
  };

  // Passive touch listeners preserve native vertical scrolling and browser edge gestures.
  win.addEventListener("touchstart", down, { passive: true });
  win.addEventListener("touchmove", move, { passive: true });
  win.addEventListener("touchend", up, { passive: true });
  win.addEventListener("touchcancel", cancelGesture, { passive: true });

  return () => {
    win.removeEventListener("touchstart", down);
    win.removeEventListener("touchmove", move);
    win.removeEventListener("touchend", up);
    win.removeEventListener("touchcancel", cancelGesture);
    start = null;
    stopFrame();
    cancelSnapBack();
    transition?.cancel();
    transition = null;
    routingDestination = null;
    surface.style.transform = "";
    surface.style.willChange = "";
  };
}
