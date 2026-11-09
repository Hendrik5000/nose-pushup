export type TextScale = 100 | 110 | 120;

export type AccessibilityPreferences = {
  textScale: TextScale;
  reduceMotion: boolean;
  keepScreenAwake: boolean;
};

export const DEFAULT_ACCESSIBILITY_PREFERENCES: AccessibilityPreferences = {
  textScale: 100,
  reduceMotion: false,
  keepScreenAwake: false,
};

export function accessibilityPreferencesKey(userId: string) {
  return `np-accessibility-v1:${encodeURIComponent(userId)}`;
}

function isTextScale(value: unknown): value is TextScale {
  return value === 100 || value === 110 || value === 120;
}

export function readAccessibilityPreferences(userId: string): AccessibilityPreferences {
  if (!userId || typeof window === "undefined") return { ...DEFAULT_ACCESSIBILITY_PREFERENCES };
  try {
    const raw = window.localStorage.getItem(accessibilityPreferencesKey(userId));
    if (!raw) return { ...DEFAULT_ACCESSIBILITY_PREFERENCES };
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value))
      return { ...DEFAULT_ACCESSIBILITY_PREFERENCES };
    const parsed = value as Partial<AccessibilityPreferences>;
    return {
      textScale: isTextScale(parsed.textScale) ? parsed.textScale : 100,
      reduceMotion: parsed.reduceMotion === true,
      keepScreenAwake: parsed.keepScreenAwake === true,
    };
  } catch {
    return { ...DEFAULT_ACCESSIBILITY_PREFERENCES };
  }
}

export function applyAccessibilityPreferences(preferences: AccessibilityPreferences) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.aloTextScale = String(preferences.textScale);
  root.style.setProperty("--alo-font-scale", String(preferences.textScale / 100));
  if (preferences.reduceMotion) root.dataset.aloReducedMotion = "true";
  else delete root.dataset.aloReducedMotion;
}

export function saveAccessibilityPreferences(
  userId: string,
  preferences: AccessibilityPreferences,
): boolean {
  if (!userId || typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(accessibilityPreferencesKey(userId), JSON.stringify(preferences));
    applyAccessibilityPreferences(preferences);
    return true;
  } catch {
    applyAccessibilityPreferences(preferences);
    return false;
  }
}
