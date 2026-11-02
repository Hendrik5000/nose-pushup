export const MIRA_VISUAL_SCHEMA_VERSION = 1 as const;
export const MIRA_VISUAL_MAX_ITEMS = 6;
export const MIRA_VISUAL_MAX_VALUE = 1_000_000;

export type MiraVisualMetricGrid = {
  type: "metricGrid";
  schemaVersion: typeof MIRA_VISUAL_SCHEMA_VERSION;
  title: string;
  items: Array<{ label: string; value: string; detail?: string }>;
};

export type MiraVisualBarChart = {
  type: "barChart";
  schemaVersion: typeof MIRA_VISUAL_SCHEMA_VERSION;
  title: string;
  unit?: MiraVisualUnit;
  items: Array<{ label: string; value: number }>;
};

export type MiraVisualUnit =
  "%" | "€" | "km" | "m" | "cm" | "kg" | "g" | "kcal" | "h" | "min" | "s" | "W" | "°C" | "Punkte";

export type MiraVisualAnswer = MiraVisualMetricGrid | MiraVisualBarChart;

const UNITS = new Set<MiraVisualUnit>([
  "%",
  "€",
  "km",
  "m",
  "cm",
  "kg",
  "g",
  "kcal",
  "h",
  "min",
  "s",
  "W",
  "°C",
  "Punkte",
]);

/** Parse only the finite, versioned shapes rendered by Mira's fixed React card. */
export function validateMiraVisualAnswer(value: unknown): MiraVisualAnswer | null {
  if (!isRecord(value) || value.schemaVersion !== MIRA_VISUAL_SCHEMA_VERSION) return null;

  if (value.type === "metricGrid") {
    if (!hasExactKeys(value, ["type", "schemaVersion", "title", "items"])) return null;
    const title = safeText(value.title, 80);
    const items = validateMetricItems(value.items);
    if (!title || !items) return null;
    return { type: "metricGrid", schemaVersion: MIRA_VISUAL_SCHEMA_VERSION, title, items };
  }

  if (value.type === "barChart") {
    if (!hasExactKeys(value, ["type", "schemaVersion", "title", "items"], ["unit"])) return null;
    const title = safeText(value.title, 80);
    const items = validateBarItems(value.items);
    const unit = value.unit;
    if (
      !title ||
      !items ||
      (unit !== undefined && (typeof unit !== "string" || !UNITS.has(unit as MiraVisualUnit))) ||
      !items.some((item) => item.value > 0)
    )
      return null;
    return {
      type: "barChart",
      schemaVersion: MIRA_VISUAL_SCHEMA_VERSION,
      title,
      ...(unit ? { unit: unit as MiraVisualUnit } : {}),
      items,
    };
  }

  return null;
}

function validateMetricItems(value: unknown): MiraVisualMetricGrid["items"] | null {
  if (!Array.isArray(value) || value.length < 2 || value.length > MIRA_VISUAL_MAX_ITEMS)
    return null;
  const items: MiraVisualMetricGrid["items"] = [];
  for (const candidate of value) {
    if (!isRecord(candidate) || !hasExactKeys(candidate, ["label", "value"], ["detail"]))
      return null;
    const label = safeText(candidate.label, 32);
    const metricValue = safeText(candidate.value, 32);
    const detail = candidate.detail === undefined ? undefined : safeText(candidate.detail, 60);
    if (!label || !metricValue || (candidate.detail !== undefined && !detail)) return null;
    items.push({ label, value: metricValue, ...(detail ? { detail } : {}) });
  }
  return items;
}

function validateBarItems(value: unknown): MiraVisualBarChart["items"] | null {
  if (!Array.isArray(value) || value.length < 2 || value.length > MIRA_VISUAL_MAX_ITEMS)
    return null;
  const items: MiraVisualBarChart["items"] = [];
  for (const candidate of value) {
    if (!isRecord(candidate) || !hasExactKeys(candidate, ["label", "value"])) return null;
    const label = safeText(candidate.label, 32);
    if (
      !label ||
      typeof candidate.value !== "number" ||
      !Number.isFinite(candidate.value) ||
      candidate.value < 0 ||
      candidate.value > MIRA_VISUAL_MAX_VALUE ||
      Math.round(candidate.value * 100) / 100 !== candidate.value
    )
      return null;
    items.push({ label, value: candidate.value });
  }
  return items;
}

function safeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (
    text.length < 1 ||
    text.length > maxLength ||
    /[<>]/.test(text) ||
    [...text].some(
      (character) => character.charCodeAt(0) <= 31 || character.charCodeAt(0) === 127,
    ) ||
    /(?:https?:\/\/|www\.)/i.test(text)
  )
    return null;
  return text;
}

function hasExactKeys(
  value: Record<string, unknown>,
  required: string[],
  optional: string[] = [],
): boolean {
  const allowed = new Set([...required, ...optional]);
  const keys = Object.keys(value);
  return (
    required.every((key) => Object.prototype.hasOwnProperty.call(value, key)) &&
    keys.every((key) => allowed.has(key))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
