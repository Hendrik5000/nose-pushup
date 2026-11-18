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
  | "contrast"
  | "glacier";

export type ThemeMode = "system" | "light" | "dark";

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
    label: "Orange",
    description: "Dunkel mit warmem Orangeakzent",
    mode: "dark",
    background: "#000000",
    card: "#1c1c1e",
    foreground: "#f5f5f7",
    swatch: ["#ff6b2c", "#1c1c1e"],
  },
  {
    id: "ember",
    label: "Feuerrot",
    description: "Dunkel mit kräftigem Rotakzent",
    mode: "dark",
    background: "#000000",
    card: "#1c1c1e",
    foreground: "#f5f5f7",
    swatch: ["#ff453a", "#2c1210"],
  },
  {
    id: "aqua",
    label: "Cyan",
    description: "Dunkel mit kühlem Cyanakzent",
    mode: "dark",
    background: "#000000",
    card: "#1c1c1e",
    foreground: "#f5f5f7",
    swatch: ["#64d2ff", "#0a1620"],
  },
  {
    id: "neon",
    label: "Grün",
    description: "Dunkel mit lebendigem Grünakzent",
    mode: "dark",
    background: "#000000",
    card: "#1c1c1e",
    foreground: "#f5f5f7",
    swatch: ["#30d158", "#0c1610"],
  },
  {
    id: "violet",
    label: "Violett",
    description: "Dunkel mit klarem Violettakzent",
    mode: "dark",
    background: "#000000",
    card: "#1c1c1e",
    foreground: "#f5f5f7",
    swatch: ["#bf5af2", "#160f1c"],
  },
  {
    id: "mono",
    label: "Monochrom",
    description: "Dunkel mit Schwarz, Weiß und Grautönen",
    mode: "dark",
    background: "#000000",
    card: "#1c1c1e",
    foreground: "#f5f5f7",
    swatch: ["#f5f5f7", "#000000"],
  },
  {
    id: "daylight",
    label: "Tageslicht",
    description: "Hell mit kühlem Blauakzent",
    mode: "light",
    background: "#f4f8ff",
    card: "#ffffff",
    foreground: "#17243a",
    swatch: ["#2069b8", "#f4f8ff"],
  },
  {
    id: "sand",
    label: "Sand",
    description: "Hell mit warmem Creme und Terrakotta",
    mode: "light",
    background: "#fbf4e8",
    card: "#fffaf1",
    foreground: "#35271f",
    swatch: ["#a8472a", "#fbf4e8"],
  },
  {
    id: "forest",
    label: "Waldgrün",
    description: "Dunkel mit Tannengrün und hellem Grün",
    mode: "dark",
    background: "#071b14",
    card: "#10291f",
    foreground: "#e6f2e9",
    swatch: ["#6fcf8b", "#071b14"],
  },
  {
    id: "midnight",
    label: "Mitternacht",
    description: "Dunkles Navy mit blauem Akzent",
    mode: "dark",
    background: "#081426",
    card: "#11223a",
    foreground: "#e8f0ff",
    swatch: ["#6ea8ff", "#081426"],
  },
  {
    id: "rose",
    label: "Rosé",
    description: "Hell mit Rosé und Beerenton",
    mode: "light",
    background: "#fff4f7",
    card: "#ffffff",
    foreground: "#3b1f2b",
    swatch: ["#b83268", "#fff4f7"],
  },
  {
    id: "contrast",
    label: "Kontrast",
    description: "Dunkel mit Gelbakzent und heller Schrift",
    mode: "dark",
    background: "#000000",
    card: "#111111",
    foreground: "#ffffff",
    swatch: ["#ffeb00", "#000000"],
  },
  {
    id: "glacier",
    label: "Eisblau",
    description: "Kühles Eisblau auf Anthrazit",
    mode: "dark",
    background: "#14181e",
    card: "#20262f",
    foreground: "#f1f6fb",
    swatch: ["#9bddff", "#14181e"],
  },
];

export const DEFAULT_THEME: ThemeId = "glacier";
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

const THEME_MODE_STORAGE_KEY = "alo-theme-mode";
const CUSTOM_ACCENT_STORAGE_KEY = "alo-custom-accent";

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === "system" || value === "light" || value === "dark";
}

export function getStoredThemeMode(): ThemeMode {
  if (typeof window === "undefined") return "system";
  try {
    const value = window.localStorage.getItem(THEME_MODE_STORAGE_KEY);
    return isThemeMode(value) ? value : "system";
  } catch {
    return "system";
  }
}

export function isCustomAccentColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

export function getStoredCustomAccent(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(CUSTOM_ACCENT_STORAGE_KEY);
    return isCustomAccentColor(value) ? value : null;
  } catch {
    return null;
  }
}

function effectiveMode(mode: ThemeMode, fallback: ThemeMode): "light" | "dark" {
  if (mode !== "system") return mode;
  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return fallback === "light" ? "light" : "dark";
}

function accentForeground(hex: string): string {
  const channels = hex.slice(1).match(/.{2}/g)?.map((part) => parseInt(part, 16)) ?? [0, 0, 0];
  const brightness = (channels[0] * 299 + channels[1] * 587 + channels[2] * 114) / 1000;
  return brightness > 150 ? "#102033" : "#ffffff";
}

/** Background color for browser/system UI metadata, following the active appearance mode. */
function updateThemeColorMeta(theme: ThemeId) {
  if (typeof document === "undefined") return;
  const definition = THEMES.find((item) => item.id === theme);
  if (!definition) return;
  const mode = getStoredThemeMode();
  const color =
    mode === "system" && typeof window !== "undefined" && typeof window.matchMedia !== "function"
      ? definition.background
      : effectiveMode(mode, definition.mode) === "light"
        ? "#f4f8ff"
        : "#14181e";
  document.querySelectorAll('meta[name="theme-color"]').forEach((element) => element.remove());
  const meta = document.createElement("meta");
  meta.setAttribute("name", "theme-color");
  meta.setAttribute("content", color);
  document.head.appendChild(meta);
}

export function applyTheme(theme: ThemeId) {
  if (typeof document === "undefined") return;
  const definition = THEMES.find((item) => item.id === theme) ?? THEMES[0]!;
  const mode = getStoredThemeMode();
  const customAccent = getStoredCustomAccent();
  const accent = customAccent ?? definition.swatch[0];
  document.documentElement.dataset["theme"] = theme;
  document.documentElement.dataset["themeMode"] = mode;
  document.documentElement.style.setProperty("--primary", accent);
  document.documentElement.style.setProperty("--ring", accent);
  document.documentElement.style.setProperty("--glow-1", `color-mix(in srgb, ${accent} 24%, transparent)`);
  document.documentElement.style.setProperty("--primary-foreground", accentForeground(accent));
  updateThemeColorMeta(theme);
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage may be unavailable; applying the visual theme still succeeds.
  }
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    window.dispatchEvent(new Event("np-theme-change"));
  }
}

export function applyThemeMode(mode: ThemeMode) {
  if (!isThemeMode(mode)) return;
  try {
    window.localStorage.setItem(THEME_MODE_STORAGE_KEY, mode);
  } catch {
    // The current page can still use the selected mode when storage is blocked.
  }
  applyTheme(getStoredTheme());
}

export function applyCustomAccent(color: string | null) {
  if (color !== null && !isCustomAccentColor(color)) return;
  try {
    if (color) window.localStorage.setItem(CUSTOM_ACCENT_STORAGE_KEY, color);
    else window.localStorage.removeItem(CUSTOM_ACCENT_STORAGE_KEY);
  } catch {
    // The accent still applies for this page when storage is blocked.
  }
  applyTheme(getStoredTheme());
}
