export type GymDayKey = string;

export interface GymDayRange {
  startDay: GymDayKey;
  endDay: GymDayKey;
}

/** Format a local calendar day without converting through UTC. */
export function localDayKey(date: Date): GymDayKey {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Parse a YYYY-MM-DD key as local noon, avoiding UTC day shifts and DST-midnight edge cases. */
export function localDateFromKey(day: GymDayKey): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const date = Number(match[3]);
  if (year < 1 || month < 0 || month > 11 || date < 1 || date > 31) return null;
  const result = new Date(year, month, date, 12);
  return result.getFullYear() === year && result.getMonth() === month && result.getDate() === date
    ? result
    : null;
}

/** Add local calendar days (not fixed 24-hour durations), safe across DST changes. */
export function addLocalDays(date: Date, amount: number): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  result.setDate(result.getDate() + amount);
  return result;
}

export function monthDayRange(month: Date): GymDayRange {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  return {
    startDay: localDayKey(new Date(year, monthIndex, 1, 12)),
    endDay: localDayKey(new Date(year, monthIndex + 1, 0, 12)),
  };
}

/** Inclusive Monday-to-Sunday bounds for the local week containing date. */
export function mondayWeekRange(date: Date): GymDayRange {
  const mondayOffset = (date.getDay() + 6) % 7;
  const monday = addLocalDays(date, -mondayOffset);
  return { startDay: localDayKey(monday), endDay: localDayKey(addLocalDays(monday, 6)) };
}

/** Return a fixed six-row, Monday-first month grid; null entries are padding cells. */
export function mondayFirstMonthGrid(month: Date): Array<GymDayKey | null> {
  const { startDay, endDay } = monthDayRange(month);
  const first = localDateFromKey(startDay)!;
  const last = localDateFromKey(endDay)!;
  const leading = (first.getDay() + 6) % 7;
  const daysInMonth = last.getDate();
  return Array.from({ length: 42 }, (_, index) => {
    const dayNumber = index - leading + 1;
    return dayNumber >= 1 && dayNumber <= daysInMonth
      ? localDayKey(new Date(month.getFullYear(), month.getMonth(), dayNumber, 12))
      : null;
  });
}

/** Count distinct valid day keys in an inclusive YYYY-MM-DD range. */
export function countUniqueGymDays(
  days: readonly string[],
  startDay: GymDayKey,
  endDay: GymDayKey,
): number {
  const unique = new Set<GymDayKey>();
  for (const day of days) {
    if (localDateFromKey(day) && day >= startDay && day <= endDay) unique.add(day);
  }
  return unique.size;
}
