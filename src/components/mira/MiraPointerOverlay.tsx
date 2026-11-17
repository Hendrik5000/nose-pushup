import { useEffect, useRef, useState } from "react";

import { MIRA_POINTER_EVENT, type MiraPointerState } from "@/lib/mira-computer-use";

/**
 * Sichtbarer virtueller Mira-Mauszeiger: Mira bewegt ihn über die gesamte Website,
 * während sie die Seite bedient. Das Label zeigt die aktuelle Aktion.
 */
export function MiraPointerOverlay() {
  const [state, setState] = useState<MiraPointerState | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onPointer = (event: Event) => {
      const detail = (event as CustomEvent<MiraPointerState>).detail;
      if (!detail || typeof detail.x !== "number" || typeof detail.y !== "number") return;
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (!detail.active) {
        hideTimer.current = setTimeout(() => setState(null), 1200);
        setState((prev) => (prev ? { ...prev, label: "", active: false } : null));
        return;
      }
      setState(detail);
      hideTimer.current = setTimeout(() => setState(null), 8000);
    };
    window.addEventListener(MIRA_POINTER_EVENT, onPointer);
    return () => {
      window.removeEventListener(MIRA_POINTER_EVENT, onPointer);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  if (!state || !state.active) return null;

  return (
    <div
      aria-hidden="false"
      data-mira-pointer-overlay
      className="pointer-events-none fixed inset-0 z-[9999]"
    >
      <p className="sr-only" aria-live="polite">
        Mira: {state.label}
      </p>
      <div
        className="absolute"
        style={{
          transform: `translate(${state.x}px, ${state.y}px)`,
          transition: "transform 420ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          className="drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]"
          role="img"
          aria-label="Mira-Zeiger"
        >
          <path
            d="M5 3l14 8.5-6.2 1.2L15 20l-2.8 1.2-2.3-7.2L5 18V3z"
            className="fill-foreground stroke-background"
            strokeWidth="1.4"
          />
        </svg>
        {state.label && (
          <span className="ml-4 mt-1 inline-block max-w-56 truncate rounded-full bg-foreground px-2.5 py-1 text-[11px] font-medium text-background shadow-lg">
            {state.label}
          </span>
        )}
      </div>
    </div>
  );
}
