export const PC_CONFIGURATOR_SCHEMA_VERSION = 1 as const;
export const PC_CONFIGURATOR_PROFILE_VERSION = "v1" as const;
export const PC_CONFIGURATOR_MIN_BUDGET = 600;
export const PC_CONFIGURATOR_MAX_BUDGET = 3500;
export const PC_CONFIGURATOR_BUDGET_STEP = 100;

export type PcConfiguratorResolution = "1080p" | "1440p" | "4k";
export type PcConfiguratorPriority = "fps" | "quiet";

/** Only user-controlled values are persisted; recommendation text is derived locally. */
export type PcConfiguratorInteraction = {
  type: "pcConfigurator";
  schemaVersion: typeof PC_CONFIGURATOR_SCHEMA_VERSION;
  budget: number;
  resolution: PcConfiguratorResolution;
  priority: PcConfiguratorPriority;
};

export type MiraInteraction = PcConfiguratorInteraction;

export type PcConfiguratorProfile = {
  version: typeof PC_CONFIGURATOR_PROFILE_VERSION;
  budgetGuidance: string;
  resolutionGuidance: string;
  priorityGuidance: string;
};

const ALLOWED_KEYS = new Set(["type", "schemaVersion", "budget", "resolution", "priority"]);
const RESOLUTIONS = new Set<PcConfiguratorResolution>(["1080p", "1440p", "4k"]);
const PRIORITIES = new Set<PcConfiguratorPriority>(["fps", "quiet"]);

/** Accept only the fixed, versioned configurator payload; discard every extra field. */
export function validateMiraInteraction(value: unknown): PcConfiguratorInteraction | null {
  if (!isRecord(value)) return null;
  const keys = Object.keys(value);
  if (keys.length !== ALLOWED_KEYS.size || keys.some((key) => !ALLOWED_KEYS.has(key))) return null;

  const { type, schemaVersion, budget, resolution, priority } = value;
  if (
    type !== "pcConfigurator" ||
    schemaVersion !== PC_CONFIGURATOR_SCHEMA_VERSION ||
    !isAllowedBudget(budget) ||
    typeof resolution !== "string" ||
    !RESOLUTIONS.has(resolution as PcConfiguratorResolution) ||
    typeof priority !== "string" ||
    !PRIORITIES.has(priority as PcConfiguratorPriority)
  )
    return null;

  return {
    type,
    schemaVersion,
    budget,
    resolution: resolution as PcConfiguratorResolution,
    priority: priority as PcConfiguratorPriority,
  };
}

/** Deterministic local guidance only; this function never checks products or current prices. */
export function getPcConfiguratorProfile(config: PcConfiguratorInteraction): PcConfiguratorProfile {
  const budgetGuidance =
    config.budget < 1200
      ? "Kompakter Zielrahmen: eine klare Priorität setzen und Extras nachrangig planen."
      : config.budget < 2200
        ? "Mittlerer Zielrahmen: Grafik, Prozessor, Arbeitsspeicher und Kühlung ausgewogen planen."
        : "Erweiterter Zielrahmen: Leistungsreserve, leisen Betrieb und spätere Upgrades gegeneinander abwägen.";

  const resolutionGuidance: Record<PcConfiguratorResolution, string> = {
    "1080p": "1080p-Profil: Grafik und Prozessor passend zum gewünschten FPS-Ziel ausbalancieren.",
    "1440p":
      "1440p-Profil: Grafikleistung und Grafikspeicher stärker gewichten; Spielanforderungen konkret prüfen.",
    "4k": "4K-Profil: Grafikleistung und Grafikspeicher priorisieren und das FPS-Ziel realistisch festlegen.",
  };

  const priorityGuidance: Record<PcConfiguratorPriority, string> = {
    fps: "Priorität FPS: Grafikleistung hervorheben und den Prozessor passend dimensionieren.",
    quiet: "Priorität leise: Effizienz, Kühlung, Lüfter und Gehäuse-Luftstrom stärker gewichten.",
  };

  return {
    version: PC_CONFIGURATOR_PROFILE_VERSION,
    budgetGuidance,
    resolutionGuidance: resolutionGuidance[config.resolution],
    priorityGuidance: priorityGuidance[config.priority],
  };
}

function isAllowedBudget(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= PC_CONFIGURATOR_MIN_BUDGET &&
    value <= PC_CONFIGURATOR_MAX_BUDGET &&
    (value - PC_CONFIGURATOR_MIN_BUDGET) % PC_CONFIGURATOR_BUDGET_STEP === 0
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
