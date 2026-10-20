import { useCallback, useEffect, useRef, useState } from "react";

/** Idle time before Mira chrome collapses into a near-fullscreen chat. */
export const APP_HEADER_IDLE_MS = 3_000;

/**
 * Auto-hide the Alo app header on immersive routes (Mira).
 * Reveals on route change, top-edge pointer/touch, or explicit reveal().
 */
export function useAutoHideAppHeader(pathname: string, enabled: boolean) {
  const headerRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const [visible, setVisible] = useState(true);

  const scheduleHide = useCallback(() => {
    if (!enabled) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      // Keep chrome when keyboard focus is inside the header or a modal is open.
      if (
        headerRef.current?.contains(document.activeElement) &&
        document.activeElement?.matches(":focus-visible")
      ) {
        return;
      }
      if (document.querySelector('[role="dialog"][data-state="open"]')) return;
      setVisible(false);
      document.documentElement.dataset.appHeaderVisible = "false";
    }, APP_HEADER_IDLE_MS);
  }, [enabled]);

  const reveal = useCallback(() => {
    setVisible(true);
    document.documentElement.dataset.appHeaderVisible = "true";
    if (enabled) scheduleHide();
    else {
      window.clearTimeout(timer.current);
    }
  }, [enabled, scheduleHide]);

  useEffect(() => {
    if (!enabled) {
      window.clearTimeout(timer.current);
      setVisible(true);
      document.documentElement.dataset.appHeaderVisible = "true";
      return;
    }
    reveal();
    const pointer = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && event.clientY <= 28) reveal();
    };
    const touch = (event: TouchEvent) => {
      if (event.touches.length === 1 && event.touches[0]!.clientY <= 40) reveal();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") reveal();
    };
    window.addEventListener("pointermove", pointer, { passive: true });
    window.addEventListener("touchstart", touch, { passive: true });
    window.addEventListener("keydown", key);
    return () => {
      window.clearTimeout(timer.current);
      window.removeEventListener("pointermove", pointer);
      window.removeEventListener("touchstart", touch);
      window.removeEventListener("keydown", key);
    };
  }, [pathname, enabled, reveal]);

  useEffect(
    () => () => {
      delete document.documentElement.dataset.appHeaderVisible;
    },
    [],
  );

  return { headerRef, visible, reveal, scheduleHide };
}
