export type DesignStyleId =
  | "soft"
  | "compact"
  | "editorial"
  | "studio"
  | "hig"
  | "performance"
  | "legacy-performance";

export interface DesignStyleDefinition {
  id: DesignStyleId;
  label: string;
  description: string;
}

/** The six selectable visual styles share Alo's semantic theme and color tokens. */
export const DESIGN_STYLES: DesignStyleDefinition[] = [
  {
    id: "soft",
    label: "Klassisch",
    description: "Vertraute, weiche Oberflächen mit ruhigen Karten und warmen Details.",
  },
  {
    id: "compact",
    label: "Kompakt",
    description: "Mehr Informationen auf einen Blick mit engeren Abständen.",
  },
  {
    id: "editorial",
    label: "Editorial",
    description: "Klare typografische Hierarchie und ein magazinartiger Seitenaufbau.",
  },
  {
    id: "studio",
    label: "Studio",
    description: "Ausgewogene Flächen und eine ruhige, kreative Arbeitsatmosphäre.",
  },
  {
    id: "hig",
    label: "Apple HIG",
    description: "Minimalistisch mit großzügigem Weißraum und klaren Systemmustern.",
  },
  {
    id: "performance",
    label: "Performance",
    description: "Sportlicher Fokus mit markanten Trainingsflächen und schneller Orientierung.",
  },
];

export const DEFAULT_DESIGN_STYLE: DesignStyleId = "hig";
const STORAGE_KEY = "np-design-style";

export function isDesignStyleId(value: unknown): value is DesignStyleId {
  return DESIGN_STYLES.some((style) => style.id === value) || value === "legacy-performance";
}

export function getStoredDesignStyle(): DesignStyleId {
  if (typeof window === "undefined") return DEFAULT_DESIGN_STYLE;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "legacy-performance") {
      window.localStorage.setItem(STORAGE_KEY, "performance");
      return "performance";
    }
    return isDesignStyleId(stored) ? stored : DEFAULT_DESIGN_STYLE;
  } catch {
    return DEFAULT_DESIGN_STYLE;
  }
}

/** Apply and persist the selected style without changing the independent color palette. */
export function applyDesignStyle(style: DesignStyleId): void {
  if (typeof document === "undefined") return;
  const nextStyle = style === "legacy-performance" ? "performance" : style;
  document.documentElement.dataset.designStyle = nextStyle;
  try {
    window.localStorage.setItem(STORAGE_KEY, nextStyle);
  } catch {
    // The selected style still applies when browser storage is unavailable.
  }
}
