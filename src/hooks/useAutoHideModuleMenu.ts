import { useCallback, useEffect, useRef, useState } from "react";

export const MODULE_MENU_IDLE_MS = 2_000;

/** A route change or interaction briefly reveals the compact module menu. */
export function useAutoHideModuleMenu(pathname: string) {
  const menuRef = useRef<HTMLElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const [visible, setVisible] = useState(true);

  const scheduleHide = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      // Never move keyboard controls away from the person currently using them.
      if (
        menuRef.current?.contains(document.activeElement) &&
        document.activeElement?.matches(":focus-visible")
      )
        return;
      setVisible(false);
      document.documentElement.dataset.moduleMenuVisible = "false";
    }, MODULE_MENU_IDLE_MS);
  }, []);

  const reveal = useCallback(() => {
    setVisible(true);
    document.documentElement.dataset.moduleMenuVisible = "true";
    scheduleHide();
  }, [scheduleHide]);

  useEffect(() => {
    reveal();
    const pointer = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && event.clientY <= 24) reveal();
    };
    const touch = (event: TouchEvent) => {
      if (event.touches.length === 1 && event.touches[0].clientY <= 32) reveal();
    };
    window.addEventListener("pointermove", pointer, { passive: true });
    window.addEventListener("touchstart", touch, { passive: true });
    return () => {
      window.clearTimeout(timer.current);
      window.removeEventListener("pointermove", pointer);
      window.removeEventListener("touchstart", touch);
    };
  }, [pathname, reveal]);

  useEffect(
    () => () => {
      delete document.documentElement.dataset.moduleMenuVisible;
    },
    [],
  );

  return { menuRef, visible, reveal, scheduleHide };
}
