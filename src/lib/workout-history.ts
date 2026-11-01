import { CALI_PATHS } from "./calisthenics";

export type HistoryWorkout = {
  id: string;
  created_at: string;
  exercise_id: string;
  count: number;
};

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
