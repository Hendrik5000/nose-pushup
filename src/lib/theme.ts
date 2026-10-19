export type ThemeId =
  | "solar"
  | "ember"
  | "aqua"
  | "neon"
  | "violet"
  | "mono"
  | "daylight"
  | "sand"
  | "forest"
  | "midnight"
  | "rose"
  | "contrast";

export type ThemeMode = "light" | "dark";

export interface ThemeDefinition {
  id: ThemeId;
  label: string;
  description: string;
  mode: ThemeMode;
  background: string;
  card: string;
  foreground: string;
  swatch: [string, string];
}

export const THEMES: ThemeDefinition[] = [
  {
    id: "solar",
    label: "Health",
    description: "Apple-Warm (Orange)",
    mode: "dark",
    background: "#000000",
    card: "#1c1c1e",
    foreground: "#f5f5f7",
    swatch: ["#ff6b2c", "#1c1c1e"],
  },
  {
    id: "ember",
    label: "Ember",
    description: "Glut & Rot",
    mode: "dark",
    background: "#000000",
    card: "#1c1c1e",
    foreground: "#f5f5f7",
    swatch: ["#ff453a", "#2c1210"],
  },
  {
    id: "aqua",
    label: "Aqua",
    description: "Kühles Cyan",
    mode: "dark",
    background: "#000000",
    card: "#1c1c1e",
    foreground: "#f5f5f7",
    swatch: ["#64d2ff", "#0a1620"],
  },
  {
    id: "neon",
    label: "Neon",
    description: "Aktiv-Grün",
    mode: "dark",
    background: "#000000",
    card: "#1c1c1e",
    foreground: "#f5f5f7",
    swatch: ["#30d158", "#0c1610"],
  },
  {
    id: "violet",
    label: "Violet",
    description: "Lila Accent",
    mode: "dark",
    background: "#000000",
    card: "#1c1c1e",
    foreground: "#f5f5f7",
    swatch: ["#bf5af2", "#160f1c"],
  },
  {
    id: "mono",
    label: "Mono",
    description: "Schlicht S/W",
    mode: "dark",
    background: "#000000",
    card: "#1c1c1e",
    foreground: "#f5f5f7",
    swatch: ["#f5f5f7", "#000000"],
  },
  {
    id: "daylight",
    label: "Daylight",
    description: "Klares Weiß & Blau",
    mode: "light",
    background: "#f4f8ff",
    card: "#ffffff",
    foreground: "#17243a",
    swatch: ["#2069b8", "#f4f8ff"],
  },
  {
    id: "sand",
    label: "Sand",
    description: "Warmes Creme & Terrakotta",
    mode: "light",
    background: "#fbf4e8",
    card: "#fffaf1",
    foreground: "#35271f",
    swatch: ["#a8472a", "#fbf4e8"],
  },
  {
    id: "forest",
    label: "Forest",
    description: "Tiefes Waldgrün",
    mode: "dark",
    background: "#071b14",
    card: "#10291f",
    foreground: "#e6f2e9",
    swatch: ["#6fcf8b", "#071b14"],
  },
  {
    id: "midnight",
    label: "Midnight",
    description: "Dunkles Navy & Blau",
    mode: "dark",
    background: "#081426",
    card: "#11223a",
    foreground: "#e8f0ff",
    swatch: ["#6ea8ff", "#081426"],
  },
  {
    id: "rose",
    label: "Rose",
    description: "Zartes Rosa & Beere",
    mode: "light",
    background: "#fff4f7",
    card: "#ffffff",
    foreground: "#3b1f2b",
    swatch: ["#b83268", "#fff4f7"],
  },
  {
    id: "contrast",
    label: "Contrast",
    description: "Schwarz & Gelb – hoher Kontrast",
    mode: "dark",
    background: "#000000",
    card: "#111111",
    foreground: "#ffffff",
    swatch: ["#ffeb00", "#000000"],
  },
];

export const DEFAULT_THEME: ThemeId = "solar";
const STORAGE_KEY = "np-theme";

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && THEMES.some((theme) => theme.id === value);
}

export function getStoredTheme(): ThemeId {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return isThemeId(value) ? value : DEFAULT_THEME;
  } catch {
    // Storage may be blocked by browser privacy settings.
    return DEFAULT_THEME;
  }
}

/** Background color for the browser/system UI theme-color metadata. */
function updateThemeColorMeta(theme: ThemeId) {
  if (typeof document === "undefined") return;
  const color = THEMES.find((definition) => definition.id === theme)?.background;
  if (!color) return;
  document.querySelectorAll('meta[name="theme-color"]').forEach((element) => element.remove());
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
    // Storage may be unavailable; applying the visual theme still succeeds.
  }
}
