import {
  Activity,
  Bell,
  CalendarDays,
  Dumbbell,
  Footprints,
  Layers,
  Plus,
  Search,
  ShieldCheck,
  Trophy,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";

export const HOME_OTHER_AREAS = [
  {
    to: "/exercises",
    label: "Übungen",
    icon: Dumbbell,
    description: "Übungskatalog und Trainingsstart",
  },
  {
    to: "/programs",
    label: "Programme",
    icon: CalendarDays,
    description: "Trainingsprogramme und Pläne",
  },
  {
    to: "/calisthenics",
    label: "Calisthenics",
    icon: Activity,
    description: "Kraft und Körpergewicht",
  },
  { to: "/run", label: "Laufen", icon: Footprints, description: "Laufen und Ausdauer" },
  { to: "/season", label: "Saison", icon: Trophy, description: "Deine aktuelle Saison" },
  {
    to: "/battle",
    label: "Wettkampf",
    icon: Dumbbell,
    description: "Wettkampf und Battles",
  },
  {
    to: "/battle-league",
    label: "Battle-Liga",
    icon: Trophy,
    description: "Liga und Ranglisten",
  },
  {
    to: "/leaderboard",
    label: "Rangliste",
    icon: Trophy,
    description: "Punkte und Bestenlisten",
  },
  { to: "/clubs", label: "Clubs", icon: Users, description: "Gemeinsam trainieren" },
  { to: "/alarm", label: "Wecker", icon: Bell, description: "Trainingswecker verwalten" },
] as const satisfies readonly {
  to: string;
  label: string;
  icon: LucideIcon;
  description: string;
}[];

export type AloWorkspaceToolId =
  "today" | "search" | "capture" | "collections" | "shortcuts" | "privacy";

export const ALO_WORKSPACE_TOOLS = [
  {
    id: "today",
    label: "Tagesübersicht",
    icon: CalendarDays,
    description: "Gespeicherte Inhalte und Aufgaben für heute ansehen.",
  },
  {
    id: "search",
    label: "Überall suchen",
    icon: Search,
    description: "Alo-Inhalte und gespeicherte Einträge durchsuchen.",
  },
  {
    id: "capture",
    label: "Schnell speichern",
    icon: Plus,
    description: "Notizen, Links und Anhänge in Alo ablegen.",
  },
  {
    id: "collections",
    label: "Sammlungen",
    icon: Layers,
    description: "Gespeicherte Inhalte ordnen und wiederfinden.",
  },
  {
    id: "shortcuts",
    label: "Schnellaktionen",
    icon: Zap,
    description: "Häufige Alo-Aktionen direkt starten.",
  },
  {
    id: "privacy",
    label: "Daten & Datenschutz",
    icon: ShieldCheck,
    description: "Synchronisierung und Datenfreigaben verwalten.",
  },
] as const satisfies readonly {
  id: AloWorkspaceToolId;
  label: string;
  icon: LucideIcon;
  description: string;
}[];

export const ALO_WORKSPACE_MENU_ORDER: readonly AloWorkspaceToolId[] = [
  "capture",
  "search",
  "today",
  "collections",
  "shortcuts",
  "privacy",
];

export function orderedAloWorkspaceTools() {
  return ALO_WORKSPACE_MENU_ORDER.map((id) => ALO_WORKSPACE_TOOLS.find((tool) => tool.id === id)!);
}
