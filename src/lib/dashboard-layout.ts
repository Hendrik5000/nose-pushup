/** Customizable home overview layout (order, size, visibility). */

export type WidgetSize = "sm" | "md" | "lg";

export type WidgetId =
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
  { id: "readiness", label: "Readiness", description: "Tagesform", defaultSize: "md" },
  { id: "briefing", label: "Daily Briefing", description: "Kurzer Überblick", defaultSize: "md" },
  { id: "quickActions", label: "Schnellaktionen", description: "4 Shortcuts", defaultSize: "md" },
  { id: "mood", label: "Stimmung", description: "Check-in", defaultSize: "sm" },
  { id: "water", label: "Wasser", description: "Trinkziel", defaultSize: "sm" },
  { id: "notes", label: "Notizen", description: "Trainingsnotizen", defaultSize: "md" },
  { id: "microChallenge", label: "Micro-Challenge", description: "Tägliche Challenge", defaultSize: "md" },
  { id: "streakFreeze", label: "Streak Freeze", description: "Streak absichern", defaultSize: "sm" },
  { id: "recoveryCal", label: "Recovery-Kalender", description: "Erholung", defaultSize: "md" },
  { id: "statsRing", label: "Stats & Level", description: "Ring + XP", defaultSize: "lg" },
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

export const DEFAULT_LAYOUT: LayoutItem[] = [
  { id: "readiness", size: "md" },
  { id: "briefing", size: "md" },
  { id: "quickActions", size: "md" },
  { id: "mood", size: "sm" },
  { id: "water", size: "sm" },
  { id: "microChallenge", size: "md" },
  { id: "streakFreeze", size: "sm" },
  { id: "statsRing", size: "lg" },
  { id: "reminder", size: "sm" },
  { id: "miniBlock", size: "md" },
  { id: "tiles", size: "md" },
  { id: "pushupHero", size: "lg" },
  { id: "notes", size: "md" },
  { id: "weekPlan", size: "md" },
  { id: "weeklyReview", size: "md" },
  { id: "aiCoach", size: "md" },
  { id: "challenges", size: "md" },
  { id: "friends", size: "md" },
  { id: "history", size: "md" },
  { id: "recoveryCal", size: "md" },
  { id: "exercises", size: "lg" },
];

const STORAGE_KEY = "np-dashboard-layout-v1";

function isWidgetId(v: unknown): v is WidgetId {
  return typeof v === "string" && WIDGET_CATALOG.some((w) => w.id === v);
}

function isSize(v: unknown): v is WidgetSize {
  return v === "sm" || v === "md" || v === "lg";
}

export function loadLayout(): LayoutItem[] {
  if (typeof window === "undefined") return DEFAULT_LAYOUT;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LAYOUT.map((x) => ({ ...x }));
    const parsed = JSON.parse(raw) as LayoutItem[];
    if (!Array.isArray(parsed) || !parsed.length) return DEFAULT_LAYOUT.map((x) => ({ ...x }));
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
}

export function resetLayout(): LayoutItem[] {
  const next = DEFAULT_LAYOUT.map((x) => ({ ...x }));
  saveLayout(next);
  return next;
}

export function widgetMeta(id: WidgetId): WidgetMeta {
  return WIDGET_CATALOG.find((w) => w.id === id) ?? {
    id,
    label: id,
    description: "",
    defaultSize: "md",
  };
}

export function nextSize(s: WidgetSize): WidgetSize {
  if (s === "sm") return "md";
  if (s === "md") return "lg";
  return "sm";
}

export function sizeClass(s: WidgetSize): string {
  if (s === "sm") return "col-span-1";
  if (s === "lg") return "col-span-2 min-h-[12rem]";
  return "col-span-2";
}
