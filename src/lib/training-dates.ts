export type TrainingRecord = {
  count: number | null;
  created_at: string | null;
};

export type TrainingWeekBounds = {
  /** Local calendar dates, formatted YYYY-MM-DD. */
  startDay: string;
  endDayExclusive: string;
  /** ISO timestamps for querying timestamptz values at local midnight. */
  startInclusive: string;
  endExclusive: string;
};

/** A calendar date key in the computer's current local timezone. */
export function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Returns the Monday 00:00 local-time boundary and the following Monday. */
export function getTrainingWeekBounds(now = new Date()): TrainingWeekBounds {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  monday.setHours(0, 0, 0, 0);
  const daysSinceMonday = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - daysSinceMonday);

  const nextMonday = new Date(monday);
  nextMonday.setDate(nextMonday.getDate() + 7);

  return {
    startDay: localDateKey(monday),
    endDayExclusive: localDateKey(nextMonday),
    startInclusive: monday.toISOString(),
    endExclusive: nextMonday.toISOString(),
  };
}

/** Sums real workout reps by the saved created_at timestamp, not by streak or best. */
export function sumTrainingWeekReps(records: readonly TrainingRecord[], now = new Date()): number {
  const { startInclusive, endExclusive } = getTrainingWeekBounds(now);
  const start = Date.parse(startInclusive);
  const end = Date.parse(endExclusive);

  return records.reduce((total, record) => {
    const createdAt = record.created_at ? Date.parse(record.created_at) : Number.NaN;
    const count = record.count;
    if (!Number.isFinite(createdAt) || createdAt < start || createdAt >= end) return total;
    if (typeof count !== "number" || !Number.isFinite(count) || count < 0) return total;
    return total + count;
  }, 0);
}
