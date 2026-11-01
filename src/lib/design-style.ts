export type DesignStyleId =
  "soft" | "compact" | "editorial" | "studio" | "performance" | "legacy-performance";

export interface DesignStyleDefinition {
  id: DesignStyleId;
  label: string;
  description: string;
}

export const DESIGN_STYLES: DesignStyleDefinition[] = [
  {
    id: "soft",
    label: "Klassisch",
    description:
      "Das bisherige Soft-Design: vertraute runde Health-Karten und die ursprüngliche Oberfläche.",
  },
  {
    id: "compact",
    label: "Kompakt",
    description: "Kompakte Abstände, kleine Ecken und eine nüchterne Sans.",
  },
  {
    id: "editorial",
    label: "Editorial",
    description: "Große Serif-Überschriften, luftige Karten und unterstrichene Navigation.",
  },
  {
    id: "studio",
    label: "Studio",
    description: "Monospace, harte 2-px-Rahmen, versetzte Schatten und Tab-Navigation.",
  },
  {
    id: "performance",
    label: "Performance",
    description:
      "Die neue Sport-Oberfläche: Fokusbereiche, große Kennzahlen, klare Linien und neue Seitenlayouts.",
  },
  {
    id: "legacy-performance",
    label: "Performance · bisher",
    description: "Die großzügige Performance-Oberfläche vor der kompletten Neugestaltung.",
  },
];

export const DEFAULT_DESIGN_STYLE: DesignStyleId = "performance";
const STORAGE_KEY = "np-design-style";

export function isDesignStyleId(value: unknown): value is DesignStyleId {
  return typeof value === "string" && DESIGN_STYLES.some((style) => style.id === value);
}

export function getStoredDesignStyle(): DesignStyleId {
  if (typeof window === "undefined") return DEFAULT_DESIGN_STYLE;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return isDesignStyleId(value) ? value : DEFAULT_DESIGN_STYLE;
  } catch {
    // Storage may be blocked by browser privacy settings.
    return DEFAULT_DESIGN_STYLE;
  }
}

/** Apply only the visual design language; the selected color theme is untouched. */
export function applyDesignStyle(style: DesignStyleId): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.designStyle = style;
  try {
    window.localStorage.setItem(STORAGE_KEY, style);
  } catch {
    // Applying the style still works when storage is unavailable.
  }
}
