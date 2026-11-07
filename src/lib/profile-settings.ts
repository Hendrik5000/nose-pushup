export const PROFILE_SETTINGS_CATEGORIES = [
  {
    id: "profile",
    title: "Profil & Konto",
    subtitle: "Name, Foto, Konto und Fortschritt",
  },
  {
    id: "apps",
    title: "Apps",
    subtitle: "Mira, Alo Health und Wecker",
  },
  {
    id: "appearance",
    title: "Darstellung & Menüfarbe",
    subtitle: "Farbwelt, Stil, Navigation und Menü-Akzent",
  },
  {
    id: "training",
    title: "Training & Coach",
    subtitle: "Smart Coach und Trainingsübersicht",
  },
  {
    id: "community",
    title: "Freunde & Community",
    subtitle: "Freunde, Badges und öffentliches Profil",
  },
  {
    id: "notifications",
    title: "Benachrichtigungen",
    subtitle: "Erinnerungen und Push-Einstellungen",
  },
  {
    id: "controls",
    title: "Bedienung",
    subtitle: "Sound und haptisches Feedback",
  },
  {
    id: "privacy",
    title: "Datenschutz & Freigaben",
    subtitle: "Aktivität und geräteübergreifende Datenschutzoptionen",
  },
  {
    id: "history",
    title: "Trainingsverlauf",
    subtitle: "Letzte Einheiten ansehen oder entfernen",
  },
  {
    id: "support",
    title: "Hilfe & Diagnose",
    subtitle: "Kurzanleitung, Tour und Fehlerberichte",
  },
] as const;

export type ProfileSettingsCategoryId = (typeof PROFILE_SETTINGS_CATEGORIES)[number]["id"];

export const PROFILE_SETTINGS_GROUPS = [
  { title: "Konto & Apps", categories: ["profile", "apps"] },
  { title: "Alo gestalten", categories: ["appearance"] },
  {
    title: "Dein Alo-Alltag",
    categories: ["training", "community", "notifications", "controls", "privacy", "history"],
  },
  { title: "Unterstützung", categories: ["support"] },
] as const satisfies ReadonlyArray<{
  title: string;
  categories: readonly ProfileSettingsCategoryId[];
}>;

export function isProfileSettingsCategory(value: unknown): value is ProfileSettingsCategoryId {
  return (
    typeof value === "string" &&
    PROFILE_SETTINGS_CATEGORIES.some((category) => category.id === value)
  );
}

export function getProfileSettingsCategory(value: unknown) {
  return PROFILE_SETTINGS_CATEGORIES.find((category) => category.id === value) ?? null;
}
