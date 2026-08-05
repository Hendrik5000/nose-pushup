export type ThemeId = "solar" | "ember" | "aqua" | "neon" | "violet" | "mono";

export const THEMES: Array<{
  id: ThemeId;
  label: string;
  description: string;
  swatch: [string, string];
}> = [
  { id: "solar", label: "Solar", description: "Warmes Gold", swatch: ["oklch(0.82 0.19 95)", "oklch(0.7 0.22 25)"] },
  { id: "ember", label: "Ember", description: "Glut & Rot", swatch: ["oklch(0.68 0.23 25)", "oklch(0.78 0.17 60)"] },
  { id: "aqua", label: "Aqua", description: "Kühles Cyan", swatch: ["oklch(0.8 0.15 200)", "oklch(0.68 0.16 240)"] },
  { id: "neon", label: "Neon", description: "Grelles Grün", swatch: ["oklch(0.85 0.2 145)", "oklch(0.75 0.18 170)"] },
  { id: "violet", label: "Violet", description: "Tiefes Lila", swatch: ["oklch(0.72 0.2 300)", "oklch(0.7 0.18 340)"] },
  { id: "mono", label: "Mono", description: "Schlicht S/W", swatch: ["oklch(0.95 0 0)", "oklch(0.6 0 0)"] },
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

/** Hintergrundfarbe je Theme – wird für die Systemleisten (theme-color) genutzt. */
const THEME_BG: Record<ThemeId, string> = {
  solar: "#0b1017",
  ember: "#150d0a",
  aqua: "#0a1017",
  neon: "#08110c",
  violet: "#120c17",
  mono: "#0a0a0a",
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
