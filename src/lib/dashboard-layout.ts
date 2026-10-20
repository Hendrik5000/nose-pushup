/** Customizable home overview layout (order, size, visibility). */

export type WidgetSize = "sm" | "md" | "lg";

export type WidgetId =
  | "trainingProgress"
  | "readiness"
  | "briefing"
  | "quickActions"
  | "mood"
  | "water"
  | "notes"
  | "microChallenge"
  | "streakFreeze"
  | "recoveryCal"
  | "statsRing"
  | "reminder"
  | "miniBlock"
  | "tiles"
  | "pushupHero"
  | "weekPlan"
  | "weeklyReview"
  | "aiCoach"
  | "challenges"
  | "friends"
  | "history"
  | "exercises";

export type LayoutItem = {
  id: WidgetId;
  size: WidgetSize;
};

export type WidgetMeta = {
  id: WidgetId;
  label: string;
  description: string;
  defaultSize: WidgetSize;
};

export const WIDGET_CATALOG: WidgetMeta[] = [
  {
    id: "trainingProgress",
    label: "Trainingsfortschritt",
    description: "Tagesziel, Trainingsserie und Wochenfortschritt",
    defaultSize: "lg",
  },
  {
    id: "readiness",
    label: "Tagesform",
    description: "Datengestützte Readiness",
    defaultSize: "md",
  },
  { id: "briefing", label: "Tagesüberblick", description: "Kurzer Überblick", defaultSize: "md" },
  { id: "quickActions", label: "Schnellaktionen", description: "4 Shortcuts", defaultSize: "md" },
  { id: "mood", label: "Stimmung", description: "Check-in", defaultSize: "sm" },
  { id: "water", label: "Wasser", description: "Trinkziel", defaultSize: "sm" },
  { id: "notes", label: "Notizen", description: "Trainingsnotizen", defaultSize: "md" },
  {
    id: "microChallenge",
    label: "Micro-Challenge",
    description: "Tägliche Challenge",
    defaultSize: "md",
  },
  {
    id: "streakFreeze",
    label: "Streak Freeze",
    description: "Streak absichern",
    defaultSize: "sm",
  },
  { id: "recoveryCal", label: "Recovery-Kalender", description: "Erholung", defaultSize: "md" },
  {
    id: "statsRing",
    label: "Bestwerte & Level",
    description: "Persönlicher Bestwert, Schritte und Level – ohne Tagesziel oder Serie",
    defaultSize: "lg",
  },
  { id: "reminder", label: "Smart Reminder", description: "Hinweis", defaultSize: "sm" },
  { id: "miniBlock", label: "Mini-Block", description: "Routine starten", defaultSize: "md" },
  { id: "tiles", label: "Navigation", description: "Chat, Health, AI…", defaultSize: "md" },
  { id: "pushupHero", label: "Push-Ups", description: "Haupt-Workout", defaultSize: "lg" },
  { id: "weekPlan", label: "Wochenplan", description: "Plan der Woche", defaultSize: "md" },
  { id: "weeklyReview", label: "Wochen-Review", description: "Rückblick", defaultSize: "md" },
  { id: "aiCoach", label: "KI-Coach", description: "Tipps", defaultSize: "md" },
  { id: "challenges", label: "Challenges", description: "Wettbewerbe", defaultSize: "md" },
  { id: "friends", label: "Freunde", description: "Aktivität", defaultSize: "md" },
  { id: "history", label: "Verlauf", description: "Letzte Workouts", defaultSize: "md" },
  { id: "exercises", label: "Weitere Übungen", description: "Bibliothek", defaultSize: "lg" },
];

export const DEFAULT_LAYOUT: LayoutItem[] = [{ id: "trainingProgress", size: "lg" }];

const STORAGE_KEY = "np-dashboard-layout-v2";

function isWidgetId(v: unknown): v is WidgetId {
  return typeof v === "string" && WIDGET_CATALOG.some((w) => w.id === v);
}

function isSize(v: unknown): v is WidgetSize {
  return v === "sm" || v === "md" || v === "lg";
}

export function loadLayout(): LayoutItem[] {
  if (typeof window === "undefined") return DEFAULT_LAYOUT.map((x) => ({ ...x }));
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LAYOUT.map((x) => ({ ...x }));
    const parsed = JSON.parse(raw) as LayoutItem[];
    if (!Array.isArray(parsed)) return DEFAULT_LAYOUT.map((x) => ({ ...x }));
    // An explicitly empty overview is a personal choice, not a missing default.
    if (parsed.length === 0) return [];
    const cleaned = parsed
      .filter((i) => i && isWidgetId(i.id) && isSize(i.size))
      .map((i) => ({ id: i.id, size: i.size }));
    // dedupe
    const seen = new Set<string>();
    const unique = cleaned.filter((i) => {
      if (seen.has(i.id)) return false;
      seen.add(i.id);
      return true;
    });
    return unique.length ? unique : DEFAULT_LAYOUT.map((x) => ({ ...x }));
  } catch {
    return DEFAULT_LAYOUT.map((x) => ({ ...x }));
  }
}

export function saveLayout(layout: LayoutItem[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // Editing still works for this session when browser storage is unavailable.
  }
}

export function resetLayout(): LayoutItem[] {
  const next = DEFAULT_LAYOUT.map((x) => ({ ...x }));
  saveLayout(next);
  return next;
}

export function widgetMeta(id: WidgetId): WidgetMeta {
  return (
    WIDGET_CATALOG.find((w) => w.id === id) ?? {
      id,
      label: id,
      description: "",
      defaultSize: "md",
    }
  );
}

export function nextSize(s: WidgetSize): WidgetSize {
  if (s === "sm") return "md";
  if (s === "md") return "lg";
  return "sm";
}

export function sizeClass(s: WidgetSize): string {
  if (s === "sm") return "col-span-1";
  if (s === "lg") return "col-span-1 md:col-span-3 xl:col-span-4 min-h-[12rem]";
  return "col-span-1 md:col-span-2";
}

export function sizeLabel(s: WidgetSize): string {
  if (s === "sm") return "Klein";
  if (s === "md") return "Mittel";
  return "Groß";
}
