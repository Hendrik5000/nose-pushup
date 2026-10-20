import { useCallback, useEffect, useRef, useState } from "react";

/** Idle time before Mira chrome collapses into a near-fullscreen chat. */
export const APP_HEADER_IDLE_MS = 2_500;

/**
 * Auto-hide the Alo app header on immersive routes (Mira).
 * Reveals on route change, top-edge pointer/touch, Escape, or explicit reveal().
 * Re-hides after idle once revealed.
 */
export function useAutoHideAppHeader(pathname: string, enabled: boolean) {
  const headerRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const [visible, setVisible] = useState(true);

  const clearTimer = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
  }, []);

  const scheduleHide = useCallback(() => {
    if (!enabled) return;
    clearTimer();
    timer.current = window.setTimeout(() => {
      if (
        headerRef.current?.contains(document.activeElement) &&
        document.activeElement?.matches(":focus-visible")
      ) {
        scheduleHide();
        return;
      }
      if (document.querySelector('[role="dialog"][data-state="open"]')) {
        scheduleHide();
        return;
      }
      setVisible(false);
      document.documentElement.dataset.appHeaderVisible = "false";
    }, APP_HEADER_IDLE_MS);
  }, [clearTimer, enabled]);

  const reveal = useCallback(() => {
    setVisible(true);
    document.documentElement.dataset.appHeaderVisible = "true";
    if (enabled) scheduleHide();
    else clearTimer();
  }, [clearTimer, enabled, scheduleHide]);

  useEffect(() => {
    if (!enabled) {
      clearTimer();
      setVisible(true);
      document.documentElement.dataset.appHeaderVisible = "true";
      return;
    }
    reveal();

    const pointer = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && event.clientY <= 32) reveal();
    };
    const touch = (event: TouchEvent) => {
      if (event.touches.length === 1 && event.touches[0]!.clientY <= 48) reveal();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") reveal();
    };
    const activity = () => {
      if (document.documentElement.dataset.appHeaderVisible !== "false") {
        scheduleHide();
      }
    };

    window.addEventListener("pointermove", pointer, { passive: true });
    window.addEventListener("touchstart", touch, { passive: true });
    window.addEventListener("keydown", key);
    window.addEventListener("scroll", activity, { passive: true });
    window.addEventListener("pointerdown", activity, { passive: true });

    return () => {
      clearTimer();
      window.removeEventListener("pointermove", pointer);
      window.removeEventListener("touchstart", touch);
      window.removeEventListener("keydown", key);
      window.removeEventListener("scroll", activity);
      window.removeEventListener("pointerdown", activity);
    };
  }, [pathname, enabled, reveal, scheduleHide, clearTimer]);

  useEffect(
    () => () => {
      clearTimer();
      delete document.documentElement.dataset.appHeaderVisible;
    },
    [clearTimer],
  );

  return { headerRef, visible, reveal, scheduleHide };
}
