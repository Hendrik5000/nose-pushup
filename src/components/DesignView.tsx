import { useSyncExternalStore, type ReactNode } from "react";
import { getStoredDesignStyle } from "@/lib/design-style";

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-design-style"],
  });
  window.addEventListener("storage", onChange);
  window.addEventListener("np-appearance-change", onChange);
  return () => {
    observer.disconnect();
    window.removeEventListener("storage", onChange);
    window.removeEventListener("np-appearance-change", onChange);
  };
}
function isSport() {
  return (document.documentElement.dataset.designStyle ?? getStoredDesignStyle()) === "performance";
}

/** Never mount two copies of forms, cameras or API-backed widgets just to hide one with CSS. */
export function DesignView({
  variant,
  children,
}: {
  variant: "sport" | "classic";
  children: ReactNode;
}) {
  const sport = useSyncExternalStore(subscribe, isSport, () => true);
  return sport === (variant === "sport") ? children : null;
}
