export type NavigationLayoutId = "top" | "bottom" | "floating" | "top-tabs";

export const NAVIGATION_LAYOUTS: {
  id: NavigationLayoutId;
  label: string;
  description: string;
}[] = [
  {
    id: "top",
    label: "Oben · Leiste",
    description: "Die vertraute, kompakte Homebar am oberen Rand.",
  },
  {
    id: "top-tabs",
    label: "Oben · Tabs",
    description: "Breite Tabs mit Symbolen und einer aktiven Unterstreichung.",
  },
  {
    id: "bottom",
    label: "Unten · Tabbar",
    description: "Feste Leiste mit Symbolen und Beschriftung am unteren Rand.",
  },
  {
    id: "floating",
    label: "Unten · Schwebend",
    description: "Eine freistehende Homebar mit Abstand zum unteren Rand.",
  },
];

export const DEFAULT_NAVIGATION_LAYOUT: NavigationLayoutId = "floating";
const STORAGE_KEY = "np-navigation-layout";
const VISIBILITY_KEY = "alo-navigation-visible";

export type NavigationScrollState = { visible: boolean; anchorY: number };
/** Hide after a meaningful downward scroll, reveal after upward scroll, and keep the bar available at the top or while focused. */
export function updateNavigationForScroll(
  state: NavigationScrollState,
  currentY: number,
  focused = false,
  threshold = 36,
): NavigationScrollState {
  if (currentY <= 32 || focused) return { visible: true, anchorY: currentY };
  const delta = currentY - state.anchorY;
  if (Math.abs(delta) < threshold) return state;
  return { visible: delta < 0, anchorY: currentY };
}

export function getNavigationVisible(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(VISIBILITY_KEY) === "true";
  } catch {
    return false;
  }
}

export function applyNavigationVisibility(visible: boolean): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.navigationVisible = String(visible);
  try {
    window.localStorage.setItem(VISIBILITY_KEY, String(visible));
  } catch {
    // Visibility can still be changed for this page if storage is blocked.
  }
}

export function isNavigationLayoutId(value: unknown): value is NavigationLayoutId {
  return typeof value === "string" && NAVIGATION_LAYOUTS.some((layout) => layout.id === value);
}

export function getStoredNavigationLayout(): NavigationLayoutId {
  if (typeof window === "undefined") return DEFAULT_NAVIGATION_LAYOUT;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return isNavigationLayoutId(value) ? value : DEFAULT_NAVIGATION_LAYOUT;
  } catch {
    return DEFAULT_NAVIGATION_LAYOUT;
  }
}

/** Position and navigation variant are independent of styles, colors and widgets. */
export function applyNavigationLayout(layout: NavigationLayoutId): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.navigationLayout = layout;
  try {
    window.localStorage.setItem(STORAGE_KEY, layout);
  } catch {
    // The live layout still works if storage is blocked.
  }
}
