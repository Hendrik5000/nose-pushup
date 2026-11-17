/**
 * Erweiterbares Home-Widget-Verzeichnis: Jedes Widget wird von einem Alo-Bereich
 * beigesteuert (sourceApp) und zeigt ausschließlich echte Daten — keine Beispiele.
 * Ein neues Widget = ein Eintrag hier + ein renderHomeWidget-Fall in der Startseite
 * (+ echte Daten über die passenden Hooks). Schema-Validierung, Bearbeitungs-Panel
 * und Widget-Größe leiten sich automatisch aus dem Katalog ab.
 */

export type HomeWidgetCatalogEntry = Readonly<{
  id: string;
  label: string;
  description: string;
  /** Alo-Bereich, der die Daten dieses Widgets beisteuert. */
  sourceApp: string;
}>;

export const HOME_WIDGET_CATALOG = Object.freeze([
  {
    id: "health-today",
    label: "Health heute",
    description: "Schritte, aktive kcal und Schlaf aus echten Messwerten.",
    sourceApp: "Alo Health",
  },
  {
    id: "fitness-week",
    label: "Training & Streak",
    description: "Workouts der letzten 7 Tage und dein aktueller Streak.",
    sourceApp: "Alo Training",
  },
  {
    id: "daily-goal",
    label: "Tagesziel",
    description: "Heutige Wiederholungen gegen dein Trainingsziel.",
    sourceApp: "Alo Training",
  },
  {
    id: "nexus-unread",
    label: "Nexus ungelesen",
    description: "Anzahl deiner ungelesenen Nexus-Nachrichten.",
    sourceApp: "Nexus",
  },
  {
    id: "postfach-unread",
    label: "Postfach ungelesen",
    description: "Anzahl deiner ungelesenen Postfach-Nachrichten.",
    sourceApp: "Postfach",
  },
  {
    id: "ai-status",
    label: "KI-Status",
    description: "Aktiver KI-Anbieter und gew\u00e4hltes Modell.",
    sourceApp: "KI-Einstellungen",
  },
  {
    id: "installed-apps",
    label: "Meine Apps",
    description: "Installierte Marketplace-Apps auf diesem Ger\u00e4t.",
    sourceApp: "Marketplace",
  },
] as const satisfies readonly HomeWidgetCatalogEntry[]);

export type HomeWidgetId = (typeof HOME_WIDGET_CATALOG)[number]["id"];
