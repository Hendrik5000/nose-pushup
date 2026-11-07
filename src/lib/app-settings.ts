export const APP_SETTINGS_ENTRIES = [
  {
    id: "mira",
    title: "Mira",
    description: "KI-Anbieter, Spracheingabe und Datenfreigaben.",
  },
  {
    id: "health",
    title: "Alo Health",
    description: "Health Connect und Smartwatch-Verbindungen.",
  },
  {
    id: "alarm",
    title: "Wecker",
    description: "Weckzeit und Aktivierung; die Wecker-Seite ist bereits der Vollbild-Editor.",
  },
] as const;

export type AppSettingsEntryId = (typeof APP_SETTINGS_ENTRIES)[number]["id"];
export type FullScreenAppSettingsId = "mira" | "health";
export type AppSettingsReturnTarget = "/settings/apps" | "/ai" | "/health";

export function isFullScreenAppSettingsId(value: unknown): value is FullScreenAppSettingsId {
  return value === "mira" || value === "health";
}

export function getAppSettingsEntry(value: unknown) {
  return APP_SETTINGS_ENTRIES.find((entry) => entry.id === value) ?? null;
}

export function resolveAppSettingsReturnTarget(
  appId: FullScreenAppSettingsId,
  value: unknown,
): AppSettingsReturnTarget {
  if (appId === "mira" && value === "/ai") return "/ai";
  if (appId === "health" && value === "/health") return "/health";
  return "/settings/apps";
}
