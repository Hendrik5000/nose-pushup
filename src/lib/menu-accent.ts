import type { ThemeId } from "@/lib/theme";

export const MENU_ACCENT_STORAGE_KEY = "alo-menu-accent";
export const DEFAULT_MENU_ACCENT = "blue" as const;

export const MENU_ACCENTS = [
  {
    id: "blue",
    label: "Blau",
    swatch: "#2b8be8",
    light: "#1355a2",
    dark: "#7ccbff",
  },
  {
    id: "purple",
    label: "Violett",
    swatch: "#9b63d8",
    light: "#5e318d",
    dark: "#d3abff",
  },
  {
    id: "green",
    label: "Grün",
    swatch: "#28945a",
    light: "#16623a",
    dark: "#7be2a0",
  },
  {
    id: "amber",
    label: "Amber",
    swatch: "#c88318",
    light: "#815000",
    dark: "#ffd36f",
  },
] as const;

export type MenuAccentId = (typeof MENU_ACCENTS)[number]["id"];

const LIGHT_THEMES = new Set<ThemeId>(["daylight", "sand", "rose"]);

export function isMenuAccentId(value: unknown): value is MenuAccentId {
  return typeof value === "string" && MENU_ACCENTS.some((accent) => accent.id === value);
}

export function getStoredMenuAccent(): MenuAccentId {
  if (typeof window === "undefined") return DEFAULT_MENU_ACCENT;
  try {
    const value = window.localStorage.getItem(MENU_ACCENT_STORAGE_KEY);
    return isMenuAccentId(value) ? value : DEFAULT_MENU_ACCENT;
  } catch {
    return DEFAULT_MENU_ACCENT;
  }
}

export function getMenuAccentColor(id: MenuAccentId, themeId: ThemeId): string {
  const accent = MENU_ACCENTS.find((item) => item.id === id)!;
  return LIGHT_THEMES.has(themeId) ? accent.light : accent.dark;
}

/** Apply a local-only menu accent without changing the user's global palette or account profile. */
export function applyMenuAccent(id: MenuAccentId, themeId?: ThemeId, persist = true): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const currentTheme = themeId ?? (root.dataset.theme as ThemeId | undefined) ?? "glacier";
  const color = getMenuAccentColor(id, currentTheme);
  root.dataset.aloMenuAccent = id;
  root.style.setProperty("--menu-accent", color);
  root.style.setProperty("--menu-accent-soft", `color-mix(in srgb, ${color} 15%, transparent)`);
  root.style.setProperty("--menu-accent-border", `color-mix(in srgb, ${color} 42%, var(--border))`);

  if (!persist) return;
  try {
    window.localStorage.setItem(MENU_ACCENT_STORAGE_KEY, id);
  } catch {
    // The selection still applies for this session if storage is unavailable.
  }
  window.dispatchEvent(new Event("alo-menu-accent-change"));
}
