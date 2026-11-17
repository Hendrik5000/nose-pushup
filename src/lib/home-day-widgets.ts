import { measuredHealthValue } from "@/lib/health-glance";
import { selectProvider, type ProviderConfig } from "@/lib/ai-providers";

export type HomeHealthToday = Readonly<{
  steps: number | null;
  activeKcal: number | null;
  sleepMin: number | null;
}>;

export type HomeAiStatus = Readonly<{
  provider: string;
  model: string;
}>;

export function parseHealthTodayRow(value: unknown): HomeHealthToday {
  const row = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const num = (input: unknown) =>
    typeof input === "number" && Number.isFinite(input) ? input : null;
  return {
    steps: num(row.steps),
    activeKcal: num(row.active_kcal),
    sleepMin: num(row.sleep_min),
  };
}

export function hasMeasuredHealthToday(entry: HomeHealthToday | null): boolean {
  if (!entry) return false;
  return (
    measuredHealthValue(entry.steps) !== null ||
    measuredHealthValue(entry.activeKcal) !== null ||
    measuredHealthValue(entry.sleepMin) !== null
  );
}

export function formatHealthTodayParts(entry: HomeHealthToday): string[] {
  const parts: string[] = [];
  const steps = measuredHealthValue(entry.steps);
  if (steps !== null) parts.push(`${steps.toLocaleString("de-DE")} Schritte`);
  const kcal = measuredHealthValue(entry.activeKcal);
  if (kcal !== null) parts.push(`${kcal.toLocaleString("de-DE")} kcal aktiv`);
  const sleep = measuredHealthValue(entry.sleepMin);
  if (sleep !== null) {
    const hours = Math.floor(sleep / 60);
    const minutes = sleep % 60;
    parts.push(minutes === 0 ? `${hours} h Schlaf` : `${hours} h ${minutes} min Schlaf`);
  }
  return parts;
}

export function formatStreakLine(streak: number): string | null {
  if (!Number.isFinite(streak) || streak <= 0) return null;
  return `${Math.floor(streak)}-Tage-Streak`;
}

export function sumKnownUnread(
  previews: Record<string, { unread: number | null } | undefined>,
): number | null {
  let total = 0;
  let known = false;
  for (const preview of Object.values(previews)) {
    if (!preview) continue;
    if (typeof preview.unread === "number" && Number.isFinite(preview.unread)) {
      known = true;
      total += Math.max(0, Math.floor(preview.unread));
    }
  }
  return known ? total : null;
}

export function aiStatusFromProviders(providers: readonly ProviderConfig[]): HomeAiStatus | null {
  const selection = selectProvider([...providers], "general");
  if (!selection.provider) return null;
  return { provider: selection.provider.label, model: selection.provider.model };
}

export const NEXUS_UNREAD_SUMMARY_THRESHOLD = 10;

export function shouldOfferChatSummary(unread: number | null): boolean {
  return unread !== null && Number.isFinite(unread) && unread >= NEXUS_UNREAD_SUMMARY_THRESHOLD;
}

export function formatDailyGoalLine(reps: number | null, goal: number): string | null {
  if (reps === null || !Number.isFinite(reps) || !Number.isFinite(goal) || goal <= 0) return null;
  const safeReps = Math.max(0, Math.floor(reps));
  const safeGoal = Math.floor(goal);
  if (safeReps >= safeGoal) return `Tagesziel erreicht: ${safeReps} / ${safeGoal}`;
  return `Heute ${safeReps} / ${safeGoal} Wiederholungen`;
}

export function formatPostfachContextLine(
  unreadCount: number,
  actionableCount: number,
  available: boolean,
): string | null {
  if (!available) return null;
  const unread = Number.isFinite(unreadCount) ? Math.max(0, Math.floor(unreadCount)) : 0;
  const actionable = Number.isFinite(actionableCount)
    ? Math.max(0, Math.floor(actionableCount))
    : 0;
  if (unread === 0 && actionable === 0) return null;
  const parts: string[] = [];
  if (unread > 0) parts.push(`${unread} ungelesene ${unread === 1 ? "Nachricht" : "Nachrichten"}`);
  if (actionable > 0)
    parts.push(`${actionable} offene ${actionable === 1 ? "Anfrage" : "Anfragen"}`);
  return parts.join(" · ");
}

export function formatWeeklyWorkoutLine(count: number): string | null {
  if (!Number.isFinite(count) || count < 0) return null;
  if (count === 0) return "Noch kein Workout diese Woche";
  return `Diese Woche: ${count} ${count === 1 ? "Workout" : "Workouts"}`;
}
