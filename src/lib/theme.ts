export type ThemeId = "solar" | "ember" | "aqua" | "neon" | "violet" | "mono";

export const THEMES: Array<{
  id: ThemeId;
  label: string;
  description: string;
  swatch: [string, string];
}> = [
  { id: "solar", label: "Health", description: "Apple-Warm (Orange)", swatch: ["#ff6b2c", "#1c1c1e"] },
  { id: "ember", label: "Ember", description: "Glut & Rot", swatch: ["#ff453a", "#2c1210"] },
  { id: "aqua", label: "Aqua", description: "Kühles Cyan", swatch: ["#64d2ff", "#0a1620"] },
  { id: "neon", label: "Neon", description: "Aktiv-Grün", swatch: ["#30d158", "#0c1610"] },
  { id: "violet", label: "Violet", description: "Lila Accent", swatch: ["#bf5af2", "#160f1c"] },
  { id: "mono", label: "Mono", description: "Schlicht S/W", swatch: ["#f5f5f7", "#000000"] },
];

export const DEFAULT_THEME: ThemeId = "solar";
const STORAGE_KEY = "np-theme";

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && THEMES.some((t) => t.id === value);
}

export function getStoredTheme(): ThemeId {
  if (typeof window === "undefined") return DEFAULT_THEME;
  const v = window.localStorage.getItem(STORAGE_KEY);
  return isThemeId(v) ? v : DEFAULT_THEME;
}

/** Hintergrundfarbe je Theme – Systemleisten (theme-color). */
const THEME_BG: Record<ThemeId, string> = {
  solar: "#000000",
  ember: "#000000",
  aqua: "#000000",
  neon: "#000000",
  violet: "#000000",
  mono: "#000000",
};

function updateThemeColorMeta(theme: ThemeId) {
  if (typeof document === "undefined") return;
  const color = THEME_BG[theme];
  document.querySelectorAll('meta[name="theme-color"]').forEach((el) => el.remove());
  const meta = document.createElement("meta");
  meta.setAttribute("name", "theme-color");
  meta.setAttribute("content", color);
  document.head.appendChild(meta);
}

export function applyTheme(theme: ThemeId) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset["theme"] = theme;
  updateThemeColorMeta(theme);
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // storage may be unavailable
  }
}
