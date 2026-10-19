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
