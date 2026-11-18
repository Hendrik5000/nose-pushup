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

/** Legacy identifiers remain readable for migration, but Alo now has one design language. */
export const DESIGN_STYLES: DesignStyleDefinition[] = [
  {
    id: "hig",
    label: "Alo Modern",
    description: "Ein einheitliches, minimalistisches Design mit großzügigem Weißraum und klarer Hierarchie.",
  },
];

export const DEFAULT_DESIGN_STYLE: DesignStyleId = "hig";
const STORAGE_KEY = "np-design-style";
const DEFAULT_MIGRATION_KEY = "np-design-style-unified-v1";
const LEGACY_STYLE_IDS: DesignStyleId[] = [
  "soft",
  "compact",
  "editorial",
  "studio",
  "performance",
  "legacy-performance",
];

export function isDesignStyleId(value: unknown): value is DesignStyleId {
  return value === "hig" || (typeof value === "string" && LEGACY_STYLE_IDS.includes(value as DesignStyleId));
}

export function getStoredDesignStyle(): DesignStyleId {
  if (typeof window === "undefined") return DEFAULT_DESIGN_STYLE;
  try {
    window.localStorage.setItem(DEFAULT_MIGRATION_KEY, "1");
    window.localStorage.setItem(STORAGE_KEY, DEFAULT_DESIGN_STYLE);
    return DEFAULT_DESIGN_STYLE;
  } catch {
    return DEFAULT_DESIGN_STYLE;
  }
}

/** All legacy style selections resolve to the single current Alo design. */
export function applyDesignStyle(_style: DesignStyleId): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.designStyle = DEFAULT_DESIGN_STYLE;
  try {
    window.localStorage.setItem(STORAGE_KEY, DEFAULT_DESIGN_STYLE);
    window.localStorage.setItem(DEFAULT_MIGRATION_KEY, "1");
  } catch {
    // The current visual design still applies when storage is unavailable.
  }
}
