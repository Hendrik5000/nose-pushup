import { getTrainingWeekBounds, localDateKey } from "./training-dates";
import { historyExercise, type HistoryWorkout } from "./workout-history";

export type WorkoutWeekComparison = {
  exerciseId: string;
  name: string;
  unit: "reps" | "seconds" | null;
  current: number;
  previous: number;
  change: number;
};

function shiftLocalDay(dayKey: string, offset: number): string {
  const day = new Date(`${dayKey}T12:00:00`);
  day.setDate(day.getDate() + offset);
  return localDateKey(day);
}

/** Compare each exercise separately for this week so far and the same weekdays last week. */
export function compareWorkoutWeeks(
  rows: readonly HistoryWorkout[],
  now = new Date(),
): WorkoutWeekComparison[] {
  const today = localDateKey(now);
  const weekStart = getTrainingWeekBounds(now).startDay;
  const currentEnd = shiftLocalDay(today, 1);
  const previousStart = shiftLocalDay(weekStart, -7);
  const previousEnd = shiftLocalDay(currentEnd, -7);
  const totals = new Map<string, { current: number; previous: number }>();

  for (const row of rows) {
    const timestamp = Date.parse(row.created_at);
    if (!Number.isFinite(timestamp) || !Number.isFinite(row.count) || row.count <= 0) continue;

    const day = localDateKey(new Date(timestamp));
    const period =
      day >= weekStart && day < currentEnd
        ? "current"
        : day >= previousStart && day < previousEnd
          ? "previous"
          : null;
    if (!period) continue;

    const exerciseTotals = totals.get(row.exercise_id) ?? { current: 0, previous: 0 };
    exerciseTotals[period] += row.count;
    totals.set(row.exercise_id, exerciseTotals);
  }

  return Array.from(totals, ([exerciseId, value]) => {
    const exercise = historyExercise(exerciseId);
    return {
      exerciseId,
      name: exercise.name,
      unit: exercise.unit,
      current: value.current,
      previous: value.previous,
      change: value.current - value.previous,
    };
  }).sort((a, b) => a.name.localeCompare(b.name, "de") || a.exerciseId.localeCompare(b.exerciseId));
}
