import type { AloRecord } from "./alo-store";

const PAGES: Record<string, string> = {
  "/": "Nose-Pushup",
  "/ai": "Mira",
  "/coach": "Mira",
  "/chat": "Nexus Chat",
  "/profile": "Einstellungen",
  "/health": "Gesundheit",
  "/exercises": "Übungen",
  "/programs": "Programme",
  "/calisthenics": "Calisthenics",
  "/run": "Laufen",
  "/season": "Saison",
  "/battle": "Wettkampf",
  "/battle-league": "Battle-Liga",
  "/leaderboard": "Rangliste",
  "/clubs": "Clubs",
};
export function aloPageIdentity(path: string) {
  const training = path.startsWith("/workout/") || path.startsWith("/cali-workout/");
  const module = ["/ai", "/coach"].includes(path)
    ? "Mira"
    : path === "/chat"
      ? "Nexus"
      : path === "/profile"
        ? "Alo"
        : "Nose-Pushup";
  return {
    title:
      PAGES[path] ??
      (training ? "Training" : path.startsWith("/battle/") ? "Wettkampf" : "Nose-Pushup"),
    module,
    back:
      path === "/"
        ? null
        : path.startsWith("/cali-workout/")
          ? "/calisthenics"
          : training
            ? "/exercises"
            : "/",
  };
}
export type SearchArea = "all" | "training" | "mira" | "nexus" | "alo";
export function searchArea(source: string): Exclude<SearchArea, "all"> {
  if (source.startsWith("Mira")) return "mira";
  if (source.startsWith("Nexus")) return "nexus";
  if (source.startsWith("Training")) return "training";
  return "alo";
}
export function priorityTasks(rows: AloRecord[], limit = 3): AloRecord[] {
  return rows
    .filter((r) => r.kind === "task" && !r.deleted && !r.body.done)
    .sort((a, b) => {
      const time = (r: AloRecord) => {
        const n = Date.parse(String(r.body.due ?? ""));
        return Number.isFinite(n) ? n : Infinity;
      };
      return time(a) - time(b) || a.updatedAt.localeCompare(b.updatedAt);
    })
    .slice(0, Math.max(0, limit));
}
export function progressState(
  loading: boolean,
  available: boolean,
  recorded: boolean,
  value: number,
) {
  if (loading) return { value: "—", label: "Wird geladen", measured: false };
  if (!available) return { value: "—", label: "Nicht verfügbar", measured: false };
  if (!recorded) return { value: "—", label: "Noch nicht erfasst", measured: false };
  return { value: String(value), label: "Erfasst", measured: true };
}

type PreviewMessage = { content: string; created_at: string; user_id: string };
export function chatRowSummary(messages: PreviewMessage[], userId: string, since?: string) {
  const latest = messages.reduce<PreviewMessage | null>(
    (last, item) => (!last || item.created_at > last.created_at ? item : last),
    null,
  );
  const unread = messages.filter(
    (item) => item.user_id !== userId && (!since || item.created_at > since),
  ).length;
  return { latest, unread };
}
