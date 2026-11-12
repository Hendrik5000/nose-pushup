import { CALI_PATHS } from "./calisthenics";
import { localDateKey } from "./training-dates";

export type HistoryWorkout = {
  id: string;
  created_at: string;
  exercise_id: string;
  count: number;
};

export const WORKOUT_HISTORY_RANGES = [35, 90, 180] as const;
export type WorkoutHistoryRange = (typeof WORKOUT_HISTORY_RANGES)[number];

export function workoutHistoryStartDay(days: WorkoutHistoryRange, now = new Date()): string {
  const start = new Date(now);
  start.setDate(start.getDate() - (days - 1));
  return localDateKey(start);
}

export function filterWorkoutHistory(
  rows: readonly HistoryWorkout[],
  exerciseId: string,
): HistoryWorkout[] {
  return exerciseId === "all" ? [...rows] : rows.filter((row) => row.exercise_id === exerciseId);
}

function csvCell(value: string | number): string {
  let text = String(value);
  if (/^[=+\-@]/.test(text.trimStart())) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function serializeWorkoutHistoryCsv(rows: readonly HistoryWorkout[]): string {
  const lines = [["Zeitpunkt", "Übung", "Anzahl", "Einheit"].map(csvCell).join(",")];
  for (const row of rows) {
    const timestamp = Date.parse(row.created_at);
    if (!Number.isFinite(timestamp) || !Number.isFinite(row.count)) continue;
    const exercise = historyExercise(row.exercise_id);
    lines.push(
      [
        new Date(timestamp).toISOString(),
        exercise.name,
        row.count,
        exercise.unit === "seconds" ? "Sekunden" : exercise.unit === "reps" ? "Wiederholungen" : "",
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return lines.join("\r\n");
}

type HistoryPage = {
  data: HistoryWorkout[] | null;
  error: unknown;
};

/** No partial history is presented as complete after a failed page. */
export async function loadWorkoutHistory(
  readPage: (from: number, to: number) => PromiseLike<HistoryPage>,
  isCancelled: () => boolean = () => false,
): Promise<HistoryWorkout[] | null> {
  const rows: HistoryWorkout[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    if (isCancelled()) return null;
    const { data, error } = await readPage(offset, offset + pageSize - 1);
    if (isCancelled()) return null;
    if (error) throw new Error("Verlauf konnte nicht vollständig geladen werden.");
    if (!data) throw new Error("Verlauf ist derzeit nicht verfügbar.");
    rows.push(...data);
    if (data.length < pageSize) return rows;
  }
}

const STANDARD_EXERCISES: Record<string, { name: string; unit: "reps" | "seconds" }> = {
  pushup: { name: "Liegestütze", unit: "reps" },
  situp: { name: "Sit-Ups", unit: "reps" },
  squat: { name: "Kniebeugen", unit: "reps" },
  burpee: { name: "Burpees", unit: "reps" },
  plank: { name: "Plank", unit: "seconds" },
};

/** Do not infer seconds merely from the cali_ prefix: some skills count reps. */
export function historyExercise(id: string | null | undefined): {
  name: string;
  unit: "reps" | "seconds" | null;
} {
  if (!id) return { name: "Training", unit: null };
  const standard = Object.hasOwn(STANDARD_EXERCISES, id) ? STANDARD_EXERCISES[id] : undefined;
  if (standard) return standard;
  const skill = CALI_PATHS.flatMap((path) => path.skills).find((entry) => entry.id === id);
  return skill
    ? { name: skill.name, unit: skill.unit }
    : { name: id.replace(/^cali_/, "").replace(/_/g, " "), unit: null };
}

export type WorkoutDaySummary = {
  day: string;
  exerciseId: string;
  name: string;
  unit: "reps" | "seconds" | null;
  sessions: number;
  total: number;
};

export function formatWorkoutDaySummary(summary: WorkoutDaySummary): string {
  const date = new Date(`${summary.day}T12:00:00`).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const unit =
    summary.unit === "seconds"
      ? "Sekunden"
      : summary.unit === "reps"
        ? "Wiederholungen"
        : "Einheiten";
  const sessions = summary.sessions === 1 ? "Session" : "Sessions";
  return `${date}: ${summary.name} — ${summary.total.toLocaleString("de-DE")} ${unit} (${summary.sessions} ${sessions})`;
}

/** Aggregate saved sessions by local calendar day and exercise without merging rows. */
export function summarizeWorkoutDays(rows: readonly HistoryWorkout[]): WorkoutDaySummary[] {
  const summaries = new Map<string, WorkoutDaySummary>();
  for (const row of rows) {
    const timestamp = Date.parse(row.created_at);
    if (!Number.isFinite(timestamp)) continue;
    const day = localDateKey(new Date(timestamp));
    const key = `${day}\u0000${row.exercise_id}`;
    let summary = summaries.get(key);
    if (!summary) {
      const exercise = historyExercise(row.exercise_id);
      summary = {
        day,
        exerciseId: row.exercise_id,
        name: exercise.name,
        unit: exercise.unit,
        sessions: 0,
        total: 0,
      };
      summaries.set(key, summary);
    }
    summary.sessions += 1;
    if (typeof row.count === "number" && Number.isFinite(row.count) && row.count >= 0) {
      summary.total += row.count;
    }
  }
  return Array.from(summaries.values()).sort(
    (a, b) =>
      b.day.localeCompare(a.day) ||
      a.name.localeCompare(b.name, "de") ||
      a.exerciseId.localeCompare(b.exerciseId),
  );
}
