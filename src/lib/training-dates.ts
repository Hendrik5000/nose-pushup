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

export type TrainingWeekDay = {
  /** Local calendar date, formatted YYYY-MM-DD. */
  dateKey: string;
  /** Sum of saved push-up reps for this local calendar day. */
  reps: number;
  isToday: boolean;
  isFuture: boolean;
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

function getValidTrainingRecord(record: TrainingRecord) {
  const createdAt = record.created_at ? Date.parse(record.created_at) : Number.NaN;
  const reps = record.count;
  if (
    !Number.isFinite(createdAt) ||
    typeof reps !== "number" ||
    !Number.isFinite(reps) ||
    reps < 0
  ) {
    return null;
  }
  return { createdAt, reps };
}

/** Sums real workout reps by the saved created_at timestamp, not by streak or best. */
export function sumTrainingWeekReps(records: readonly TrainingRecord[], now = new Date()): number {
  const { startInclusive, endExclusive } = getTrainingWeekBounds(now);
  const start = Date.parse(startInclusive);
  const end = Date.parse(endExclusive);

  return records.reduce((total, record) => {
    const validRecord = getValidTrainingRecord(record);
    if (!validRecord || validRecord.createdAt < start || validRecord.createdAt >= end) return total;
    return total + validRecord.reps;
  }, 0);
}

/** Buckets saved reps into Monday–Sunday local calendar days for the current week. */
export function getTrainingWeekDailyReps(
  records: readonly TrainingRecord[],
  now = new Date(),
): TrainingWeekDay[] {
  const bounds = getTrainingWeekBounds(now);
  const weekStart = new Date(bounds.startInclusive);
  const weekEnd = Date.parse(bounds.endExclusive);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  today.setHours(0, 0, 0, 0);
  const todayKey = localDateKey(today);
  const repsByDay = new Map<string, number>();

  for (const record of records) {
    const validRecord = getValidTrainingRecord(record);
    if (
      !validRecord ||
      validRecord.createdAt < weekStart.getTime() ||
      validRecord.createdAt >= weekEnd
    )
      continue;
    const dayKey = localDateKey(new Date(validRecord.createdAt));
    repsByDay.set(dayKey, (repsByDay.get(dayKey) ?? 0) + validRecord.reps);
  }

  return Array.from({ length: 7 }, (_, offset) => {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + offset);
    const dateKey = localDateKey(day);
    return {
      dateKey,
      reps: repsByDay.get(dateKey) ?? 0,
      isToday: dateKey === todayKey,
      isFuture: dateKey > todayKey,
    };
  });
}
