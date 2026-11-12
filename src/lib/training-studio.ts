import { getTrainingWeekBounds, localDateKey } from "./training-dates";
import { historyExercise, type HistoryWorkout } from "./workout-history";

export type TrainingStudioGroupId = "leistung" | "rhythmus" | "uebungen" | "ziele" | "coaching";

export type TrainingStudioInsight = {
  id: string;
  group: TrainingStudioGroupId;
  label: string;
  value: string;
  detail: string;
};

export type TrainingStudioGoals = {
  weeklySessionTarget: number;
  focusExerciseId: string;
  focusBestTarget: number;
  targetDate: string;
};

export const DEFAULT_TRAINING_STUDIO_GOALS: TrainingStudioGoals = {
  weeklySessionTarget: 3,
  focusExerciseId: "pushup",
  focusBestTarget: 50,
  targetDate: "",
};

const STORAGE_PREFIX = "alo-training-studio-v1";
const MAX_COUNT = 1_000_000;
const DAY_MS = 86_400_000;
const GROUP_ORDER: TrainingStudioGroupId[] = [
  "leistung",
  "rhythmus",
  "uebungen",
  "ziele",
  "coaching",
];
const GROUP_LABELS: Record<TrainingStudioGroupId, string> = {
  leistung: "Leistung & Verlauf",
  rhythmus: "Rhythmus & Erholung",
  uebungen: "Übungen & Fokus",
  ziele: "Ziele & Etappen",
  coaching: "Hinweise & Transparenz",
};

export function trainingStudioGroupLabel(group: TrainingStudioGroupId): string {
  return GROUP_LABELS[group];
}

export function trainingStudioStorageKey(userId: string): string {
  return `${STORAGE_PREFIX}:${encodeURIComponent(userId)}`;
}

function safeGoalValue(value: unknown, min: number, max: number, fallback: number): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isInteger(number) && number >= min && number <= max ? number : fallback;
}

function dateOrdinal(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return Number.NaN;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value
    ? timestamp / DAY_MS
    : Number.NaN;
}

export function trainingStudioCalendarDayDifference(fromDay: string, toDay: string): number {
  return dateOrdinal(toDay) - dateOrdinal(fromDay);
}

function isValidGoalDate(value: string): boolean {
  return Number.isFinite(dateOrdinal(value));
}

export function normalizeTrainingStudioGoals(value: unknown): TrainingStudioGoals {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...DEFAULT_TRAINING_STUDIO_GOALS };
  }
  const record = value as Record<string, unknown>;
  const focusExerciseId =
    typeof record.focusExerciseId === "string" &&
    /^[a-zA-Z0-9_-]{1,80}$/.test(record.focusExerciseId)
      ? record.focusExerciseId
      : DEFAULT_TRAINING_STUDIO_GOALS.focusExerciseId;
  const targetDate =
    typeof record.targetDate === "string" &&
    (record.targetDate === "" || isValidGoalDate(record.targetDate))
      ? record.targetDate
      : "";
  return {
    weeklySessionTarget: safeGoalValue(
      record.weeklySessionTarget,
      1,
      7,
      DEFAULT_TRAINING_STUDIO_GOALS.weeklySessionTarget,
    ),
    focusExerciseId,
    focusBestTarget: safeGoalValue(
      record.focusBestTarget,
      1,
      MAX_COUNT,
      DEFAULT_TRAINING_STUDIO_GOALS.focusBestTarget,
    ),
    targetDate,
  };
}

export function loadTrainingStudioGoals(
  storage: Pick<Storage, "getItem">,
  userId: string,
): TrainingStudioGoals {
  try {
    const raw = storage.getItem(trainingStudioStorageKey(userId));
    return raw
      ? normalizeTrainingStudioGoals(JSON.parse(raw))
      : { ...DEFAULT_TRAINING_STUDIO_GOALS };
  } catch {
    return { ...DEFAULT_TRAINING_STUDIO_GOALS };
  }
}

export function saveTrainingStudioGoals(
  storage: Pick<Storage, "setItem">,
  userId: string,
  goals: TrainingStudioGoals,
): boolean {
  if (!userId || userId.length > 256) return false;
  try {
    storage.setItem(
      trainingStudioStorageKey(userId),
      JSON.stringify(normalizeTrainingStudioGoals(goals)),
    );
    return true;
  } catch {
    return false;
  }
}

function validHistoryRows(rows: readonly HistoryWorkout[]) {
  const valid: Array<HistoryWorkout & { timestamp: number; day: string }> = [];
  let ignored = 0;
  for (const row of rows) {
    if (!row || typeof row !== "object") {
      ignored += 1;
      continue;
    }
    const timestamp = Date.parse(row.created_at);
    if (
      typeof row.id !== "string" ||
      typeof row.exercise_id !== "string" ||
      row.exercise_id.length === 0 ||
      row.exercise_id.length > 120 ||
      !Number.isFinite(timestamp) ||
      !Number.isSafeInteger(row.count) ||
      row.count < 0 ||
      row.count > MAX_COUNT
    ) {
      ignored += 1;
      continue;
    }
    valid.push({ ...row, timestamp, day: localDateKey(new Date(timestamp)) });
  }
  return { valid, ignored };
}

function shiftDayKey(now: Date, days: number): string {
  const shifted = new Date(now);
  shifted.setDate(shifted.getDate() + days);
  return localDateKey(shifted);
}

function sum(rows: readonly { count: number }[]): number {
  return rows.reduce((total, row) => total + row.count, 0);
}

function median(values: readonly number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function formatNumber(value: number | null): string {
  return value == null || !Number.isFinite(value)
    ? "—"
    : value.toLocaleString("de-DE", { maximumFractionDigits: 1 });
}

function formatPercentChange(current: number, previous: number): string {
  if (previous <= 0) return current > 0 ? "Neu" : "—";
  const change = Math.round(((current - previous) / previous) * 100);
  return `${change > 0 ? "+" : ""}${change} %`;
}

function weekdayIndex(day: string): number {
  return (new Date(`${day}T12:00:00`).getDay() + 6) % 7;
}

const WEEKDAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

function consecutiveDayStats(days: readonly string[], today: string) {
  const unique = [...new Set(days)].sort();
  let longest = 0;
  let currentRun = 0;
  let run = 0;
  let previousDay: string | null = null;
  const gaps: number[] = [];
  for (const day of unique) {
    if (previousDay) {
      const difference = trainingStudioCalendarDayDifference(previousDay, day);
      gaps.push(difference);
      run = difference === 1 ? run + 1 : 1;
    } else {
      run = 1;
    }
    longest = Math.max(longest, run);
    previousDay = day;
  }
  const hasToday = unique.includes(today);
  const hasYesterday = unique.includes(shiftDayKey(new Date(`${today}T12:00:00`), -1));
  if (hasToday || hasYesterday) {
    const end = hasToday ? today : shiftDayKey(new Date(`${today}T12:00:00`), -1);
    const cursor = new Date(`${end}T12:00:00`);
    currentRun = 0;
    while (unique.includes(localDateKey(cursor))) {
      currentRun += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
  }
  return {
    unique,
    currentRun,
    longest,
    averageGap: gaps.length ? gaps.reduce((total, gap) => total + gap, 0) / gaps.length : null,
    longestGap: gaps.length ? Math.max(...gaps) : null,
  };
}

function formatDay(day: string | null): string {
  if (!day) return "—";
  return new Date(`${day}T12:00:00`).toLocaleDateString("de-DE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDurationDays(days: number | null): string {
  if (days == null || !Number.isFinite(days)) return "—";
  return `${Math.max(0, Math.round(days))} ${Math.round(days) === 1 ? "Tag" : "Tage"}`;
}

function insight(
  id: number,
  group: TrainingStudioGroupId,
  label: string,
  value: string,
  detail: string,
): TrainingStudioInsight {
  return { id: `studio-${id}`, group, label, value, detail };
}

/** Build 50 account-local insights from the already loaded workout history; no network writes. */
export function buildTrainingStudioInsights(
  rows: readonly HistoryWorkout[],
  rangeDays: number,
  goalsInput: TrainingStudioGoals,
  now = new Date(),
): TrainingStudioInsight[] {
  const goals = normalizeTrainingStudioGoals(goalsInput);
  const { valid, ignored } = validHistoryRows(rows);
  const today = localDateKey(now);
  const rangeDaysSafe = Number.isFinite(rangeDays)
    ? Math.max(1, Math.min(180, Math.floor(rangeDays)))
    : 90;
  const start = shiftDayKey(now, -(rangeDaysSafe - 1));
  const periodRows = valid.filter((row) => row.day >= start && row.day <= today);
  const focusId = goals.focusExerciseId;
  const focusMeta = historyExercise(focusId);
  const focusUnit =
    focusMeta.unit === "seconds"
      ? "Sekunden"
      : focusMeta.unit === "reps"
        ? "Wiederholungen"
        : "Einheiten";
  const focusRows = periodRows.filter((row) => row.exercise_id === focusId);
  const focusDayCount = new Set(focusRows.map((row) => row.day)).size;
  const activeDays = [...new Set(periodRows.map((row) => row.day))].sort();
  const streak = consecutiveDayStats(activeDays, today);
  const currentWeek = getTrainingWeekBounds(now);
  const currentWeekRows = valid.filter(
    (row) => row.day >= currentWeek.startDay && row.day < currentWeek.endDayExclusive,
  );
  const thisWeekDays = new Set(currentWeekRows.map((row) => row.day));
  const focusPersonalBest = focusRows.reduce((best, row) => Math.max(best, row.count), 0);
  const current7Start = shiftDayKey(now, -6);
  const previous7Start = shiftDayKey(now, -13);
  const last7 = valid.filter((row) => row.day >= current7Start && row.day <= today);
  const prior7 = valid.filter((row) => row.day >= previous7Start && row.day < current7Start);
  const last7Reps = sum(last7.filter((row) => historyExercise(row.exercise_id).unit === "reps"));
  const prior7Reps = sum(prior7.filter((row) => historyExercise(row.exercise_id).unit === "reps"));
  const last14Start = shiftDayKey(now, -13);
  const prior14Start = shiftDayKey(now, -27);
  const last14Focus = sum(
    valid.filter(
      (row) => row.exercise_id === focusId && row.day >= last14Start && row.day <= today,
    ),
  );
  const prior14Focus = sum(
    valid.filter(
      (row) => row.exercise_id === focusId && row.day >= prior14Start && row.day < last14Start,
    ),
  );
  const exerciseMap = new Map<string, typeof periodRows>();
  for (const row of periodRows) {
    const list = exerciseMap.get(row.exercise_id) ?? [];
    list.push(row);
    exerciseMap.set(row.exercise_id, list);
  }
  const exerciseStats = [...exerciseMap.entries()].map(([id, exerciseRows]) => ({
    id,
    name: historyExercise(id).name,
    unit: historyExercise(id).unit,
    sessions: exerciseRows.length,
    total: sum(exerciseRows),
    best: exerciseRows.reduce((best, row) => Math.max(best, row.count), 0),
    average: sum(exerciseRows) / exerciseRows.length,
    lastDay: exerciseRows.reduce((latest, row) => (row.day > latest ? row.day : latest), ""),
    days: new Set(exerciseRows.map((row) => row.day)).size,
  }));
  const sortedExercises = [...exerciseStats].sort(
    (a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name, "de"),
  );
  const allWeekdayCounts = Array(7).fill(0) as number[];
  for (const row of periodRows) allWeekdayCounts[weekdayIndex(row.day)] += 1;
  const bestWeekdayIndex = allWeekdayCounts.reduce(
    (best, count, index) => (count > allWeekdayCounts[best] ? index : best),
    0,
  );
  const weekendSessions = periodRows.filter((row) => weekdayIndex(row.day) >= 5).length;
  const periodReps = sum(
    periodRows.filter((row) => historyExercise(row.exercise_id).unit === "reps"),
  );
  const periodSeconds = sum(
    periodRows.filter((row) => historyExercise(row.exercise_id).unit === "seconds"),
  );
  const repetitionDays = new Set(
    periodRows
      .filter((row) => historyExercise(row.exercise_id).unit === "reps")
      .map((row) => row.day),
  ).size;
  const repetitionsPerActiveDay = repetitionDays ? periodReps / repetitionDays : null;
  const focusCounts = focusRows.map((row) => row.count);
  const recentFocusBest = focusRows
    .filter((row) => row.day >= last14Start)
    .reduce((best, row) => Math.max(best, row.count), 0);
  const priorFocusBest = valid
    .filter(
      (row) => row.exercise_id === focusId && row.day >= prior14Start && row.day < last14Start,
    )
    .reduce((best, row) => Math.max(best, row.count), 0);
  const focusBestTrend = formatPercentChange(recentFocusBest, priorFocusBest);
  const focusMinimum = focusCounts.length
    ? focusCounts.reduce((minimum, count) => Math.min(minimum, count), focusCounts[0] ?? 0)
    : null;
  const bestSession = focusRows.reduce<(typeof focusRows)[number] | null>(
    (best, row) =>
      !best ||
      row.count > best.count ||
      (row.count === best.count && row.timestamp > best.timestamp)
        ? row
        : best,
    null,
  );
  const sessionsSinceBest = bestSession
    ? focusRows.filter((row) => row.timestamp > bestSession.timestamp).length
    : null;
  const currentPeriodFocus = sum(focusRows);
  const weeksInRange = rangeDaysSafe / 7;
  const mostRecent = [...valid].sort((a, b) => b.timestamp - a.timestamp)[0];
  const daysSinceLast = mostRecent
    ? Math.max(0, trainingStudioCalendarDayDifference(mostRecent.day, today))
    : null;
  const currentGoalProgress =
    focusRows.length && goals.focusBestTarget
      ? Math.min(100, Math.round((focusPersonalBest / goals.focusBestTarget) * 100))
      : null;
  const targetRemaining = focusRows.length
    ? Math.max(0, goals.focusBestTarget - focusPersonalBest)
    : null;
  const targetEtaWeeks = (() => {
    if (focusRows.length < 4 || targetRemaining == null || targetRemaining <= 0) return null;
    const sorted = [...focusRows].sort((a, b) => a.timestamp - b.timestamp);
    if (trainingStudioCalendarDayDifference(sorted[0].day, sorted.at(-1)!.day) < 28) return null;
    const split = Math.floor(sorted.length / 2);
    const earlier = sorted.slice(0, split);
    const later = sorted.slice(split);
    const earlierMedian = median(earlier.map((row) => row.count));
    const laterMedian = median(later.map((row) => row.count));
    if (earlierMedian == null || laterMedian == null) return null;
    const earlierMidpoint = (earlier[0].timestamp + earlier.at(-1)!.timestamp) / 2;
    const laterMidpoint = (later[0].timestamp + later.at(-1)!.timestamp) / 2;
    const elapsedWeeks =
      trainingStudioCalendarDayDifference(
        localDateKey(new Date(earlierMidpoint)),
        localDateKey(new Date(laterMidpoint)),
      ) / 7;
    const weeklyGain =
      Number.isFinite(elapsedWeeks) && elapsedWeeks > 0
        ? (laterMedian - earlierMedian) / elapsedWeeks
        : 0;
    return weeklyGain > 0 ? Math.ceil(targetRemaining / weeklyGain) : null;
  })();
  const last14Change = formatPercentChange(last14Focus, prior14Focus);
  const weeklyChange = formatPercentChange(last7Reps, prior7Reps);
  const dataCoverage = valid.length
    ? `${valid.length} gültige · ${ignored} ausgelassen`
    : "Noch keine gültigen Einträge";
  const targetDateValue = goals.targetDate ? formatDay(goals.targetDate) : "Kein Datum gesetzt";
  const targetDateDelta = goals.targetDate
    ? trainingStudioCalendarDayDifference(today, goals.targetDate)
    : null;
  const targetDateNote =
    targetDateDelta == null
      ? "Optionales Zieldatum wird nur lokal gespeichert."
      : targetDateDelta < 0
        ? "Das gewählte Datum liegt zurück; du kannst es jederzeit anpassen."
        : `${targetDateDelta} Tage bis zum selbst gewählten Datum.`;
  const focusBestValue = focusRows.length ? formatNumber(focusPersonalBest) : "—";
  const progressSummary = periodRows.length
    ? `${periodRows.length} Einheiten im Zeitraum; ${activeDays.length} aktive Tage; Fokus ${focusMeta.name}: ${focusBestValue} ${focusUnit} Bestwert.`
    : "Im gewählten Zeitraum liegen noch keine gültigen Trainingseinträge vor.";
  const mostRecentExercise = [...exerciseStats].sort((a, b) =>
    b.lastDay.localeCompare(a.lastDay),
  )[0];
  const leastRecentExercise = [...exerciseStats].sort((a, b) =>
    a.lastDay.localeCompare(b.lastDay),
  )[0];
  const exerciseBalance = periodRows.length
    ? Math.round(((sortedExercises[0]?.sessions ?? 0) / periodRows.length) * 100)
    : 0;
  const weekdayTop = WEEKDAYS[bestWeekdayIndex] ?? "—";
  const averageInterval = streak.averageGap;
  const activeWeekKeys = new Set(
    activeDays.map((day) => {
      const date = new Date(`${day}T12:00:00`);
      const week = getTrainingWeekBounds(date);
      return week.startDay;
    }),
  );
  const activeWeekCount = activeWeekKeys.size;
  const weeklyFrequency = periodRows.length / weeksInRange;
  const activeDayFrequency = activeDays.length / weeksInRange;
  const weekdayMapText = WEEKDAYS.map(
    (name, index) => `${name.slice(0, 2)} ${allWeekdayCounts[index]}`,
  ).join(" · ");
  const focusMedian = median(focusCounts);
  const focusAverage = focusCounts.length ? sum(focusRows) / focusRows.length : null;
  const timeWindowCounts = [
    { label: "Morgens", count: 0 },
    { label: "Nachmittags", count: 0 },
    { label: "Abends", count: 0 },
  ];
  for (const row of periodRows) {
    const hour = new Date(row.timestamp).getHours();
    const window = hour < 12 ? 0 : hour < 17 ? 1 : 2;
    timeWindowCounts[window].count += 1;
  }
  const preferredTimeWindow = periodRows.length
    ? [...timeWindowCounts].sort((a, b) => b.count - a.count)[0]
    : null;
  const bestMonth = (() => {
    const monthTotals = new Map<string, number>();
    for (const row of periodRows) {
      const month = row.day.slice(0, 7);
      monthTotals.set(month, (monthTotals.get(month) ?? 0) + 1);
    }
    const best = [...monthTotals.entries()].sort((a, b) => b[1] - a[1])[0];
    return best ? `${best[0]} · ${best[1]} Einheiten` : "—";
  })();
  const goalSessionProgress = `${thisWeekDays.size} / ${goals.weeklySessionTarget} Trainingstage`;
  const sessionsToGoal = Math.max(0, goals.weeklySessionTarget - thisWeekDays.size);
  const trainingRecommendation =
    daysSinceLast == null
      ? "Sammle erst ein paar Einheiten; daraus entsteht dein persönlicher Rhythmus."
      : daysSinceLast === 0
        ? "Heute ist bereits eine Einheit gespeichert; ein zusätzlicher Block ist optional."
        : daysSinceLast >= 4
          ? "Nach einer längeren Pause ist ein lockerer Wiedereinstieg eine Option."
          : "Dein jüngster Eintrag ist noch frisch; plane nach deinem Wohlbefinden.";
  const goalPace =
    targetRemaining == null
      ? "Im gewählten Zeitraum fehlen Fokus-Einträge für eine Zielprojektion."
      : targetRemaining === 0
        ? "Das lokale Ziel ist im gewählten Zeitraum bereits erreicht."
        : targetEtaWeeks == null
          ? "Noch keine Schätzung; mindestens vier Fokus-Einträge über vier Wochen helfen."
          : `Grobe Datenprojektion: etwa ${targetEtaWeeks} Wochen bei ähnlichem Verlauf; keine Zusage.`;

  const items: TrainingStudioInsight[] = [
    insight(
      1,
      "leistung",
      "Einheiten im Zeitraum",
      formatNumber(periodRows.length),
      `${rangeDaysSafe} Tage, nach lokalem Trainingstag gruppiert.`,
    ),
    insight(
      2,
      "leistung",
      "Aktive Trainingstage",
      formatNumber(activeDays.length),
      "Tage mit mindestens einem gespeicherten Eintrag.",
    ),
    insight(
      3,
      "leistung",
      "Wiederholungen gesamt",
      formatNumber(periodReps),
      "Nur Übungen mit Wiederholungs-Einheit; Sekunden werden getrennt geführt.",
    ),
    insight(
      4,
      "leistung",
      "Haltezeit gesamt",
      `${formatNumber(periodSeconds)} Sek.`,
      "Nur Übungen mit Sekunden-Einheit.",
    ),
    insight(
      5,
      "leistung",
      "Ø Fokusübung pro Einheit",
      formatNumber(focusAverage),
      `${focusMeta.name}; Einträge werden nicht mit anderen Einheiten vermischt.`,
    ),
    insight(
      6,
      "leistung",
      "Median der Fokus-Einheiten",
      formatNumber(focusMedian),
      "Der Median ist weniger anfällig für einzelne Ausreißer.",
    ),
    insight(
      7,
      "leistung",
      "Tag mit Fokus-Bestwert",
      bestSession ? formatDay(localDateKey(new Date(bestSession.timestamp))) : "—",
      bestSession
        ? `${focusMeta.name}: ${formatNumber(bestSession.count)} ${focusUnit}.`
        : "Noch keine Fokus-Einträge.",
    ),
    insight(
      8,
      "leistung",
      "Niedrigster Fokus-Eintrag",
      formatNumber(focusMinimum),
      "Gültige Einträge einschließlich Teiltrainings.",
    ),
    insight(
      9,
      "leistung",
      "Monat mit den meisten Einheiten",
      bestMonth,
      "Monate werden nur innerhalb des ausgewählten Zeitraums verglichen.",
    ),
    insight(
      10,
      "leistung",
      "Fokus-Volumen im Zeitraum",
      focusRows.length ? formatNumber(currentPeriodFocus) : "—",
      `${focusMeta.name} · ${focusUnit}; nicht mit anderen Übungen vermischt.`,
    ),

    insight(
      11,
      "rhythmus",
      "Aktive Wochen",
      formatNumber(activeWeekCount),
      "Kalenderwochen mit mindestens einem gespeicherten Training.",
    ),
    insight(
      12,
      "rhythmus",
      "Ø Einheiten pro Woche",
      formatNumber(weeklyFrequency),
      "Einträge pro Woche im ausgewählten Zeitraum.",
    ),
    insight(
      13,
      "rhythmus",
      "Ø aktive Tage pro Woche",
      formatNumber(activeDayFrequency),
      "Aktive Kalendertage pro Woche.",
    ),
    insight(
      14,
      "rhythmus",
      "Aktuelle Tages-Serie",
      formatDurationDays(streak.currentRun),
      "Zählt aufeinanderfolgende Tage; endet spätestens gestern, wenn heute nichts gespeichert ist.",
    ),
    insight(
      15,
      "rhythmus",
      "Längste Tages-Serie",
      formatDurationDays(streak.longest),
      "Innerhalb der verfügbaren Trainingshistorie.",
    ),
    insight(
      16,
      "rhythmus",
      "Ø Abstand zwischen Trainingstagen",
      formatDurationDays(averageInterval),
      "Abstand zwischen unterschiedlichen lokalen Kalendertagen.",
    ),
    insight(
      17,
      "rhythmus",
      "Längste Trainingspause",
      formatDurationDays(streak.longestGap),
      "Nur Abstände zwischen erfassten aktiven Tagen.",
    ),
    insight(
      18,
      "rhythmus",
      "Häufigster Trainingstag",
      periodRows.length ? weekdayTop : "—",
      weekdayMapText,
    ),
    insight(
      19,
      "rhythmus",
      "Wochenend-Anteil",
      periodRows.length ? `${Math.round((weekendSessions / periodRows.length) * 100)} %` : "—",
      "Samstag und Sonntag geteilt durch alle Einträge.",
    ),
    insight(
      20,
      "rhythmus",
      "Einheiten diese Woche",
      formatNumber(currentWeekRows.length),
      "Gespeicherte Einträge seit Beginn der aktuellen lokalen Trainingswoche.",
    ),

    insight(
      21,
      "uebungen",
      "Übungen genutzt",
      formatNumber(exerciseStats.length),
      "Unterschiedliche Übungs-IDs im ausgewählten Zeitraum.",
    ),
    insight(
      22,
      "uebungen",
      "Häufigste Übung",
      sortedExercises[0]?.name ?? "—",
      sortedExercises[0] ? `${sortedExercises[0].sessions} Einheiten` : "Noch keine Daten.",
    ),
    insight(
      23,
      "uebungen",
      "Zuletzt trainierte Übung",
      mostRecentExercise?.name ?? "—",
      mostRecentExercise ? formatDay(mostRecentExercise.lastDay) : "Noch keine Daten.",
    ),
    insight(
      24,
      "uebungen",
      "Am längsten nicht trainiert",
      leastRecentExercise?.name ?? "—",
      leastRecentExercise
        ? `Letzter Eintrag ${formatDay(leastRecentExercise.lastDay)}; nur Übungen mit Einträgen.`
        : "Noch keine Daten.",
    ),
    insight(
      25,
      "uebungen",
      "Fokus-Übungseinheiten",
      formatNumber(focusRows.length),
      focusMeta.name,
    ),
    insight(
      26,
      "uebungen",
      "Fokus-Bestwert im Zeitraum",
      focusRows.length ? formatNumber(focusPersonalBest) : "—",
      focusRows.length
        ? `${focusMeta.name} · ${focusUnit}; nur der aktuell geladene Zeitraum.`
        : `Keine Fokus-Einträge für ${focusMeta.name} im gewählten Zeitraum.`,
    ),
    insight(
      27,
      "uebungen",
      "Fokus-Trainingstage",
      formatNumber(focusDayCount),
      `${focusMeta.name}; mehrere Einträge am selben Tag zählen als ein Tag.`,
    ),
    insight(
      28,
      "uebungen",
      "Fokus-Trend über 14 Tage",
      last14Change,
      "Letzte 14 Tage gegenüber den vorherigen 14 Tagen.",
    ),
    insight(
      29,
      "uebungen",
      "Anteil häufigster Übung",
      periodRows.length ? `${exerciseBalance} %` : "—",
      "Anteil an allen gespeicherten Einheiten, nicht an Wiederholungen.",
    ),
    insight(
      30,
      "uebungen",
      "Übungsvielfalt",
      periodRows.length ? `${exerciseStats.length} von ${periodRows.length} Einheiten-Typen` : "—",
      "Mehr Vielfalt ist nicht automatisch besser; es ist ein Überblick, kein Werturteil.",
    ),

    insight(
      31,
      "ziele",
      "Wochenziel: Trainingstage",
      `${goals.weeklySessionTarget} Tage`,
      "Nur auf diesem Gerät und für dieses Konto gespeichert.",
    ),
    insight(
      32,
      "ziele",
      "Fortschritt zum Wochenziel",
      goalSessionProgress,
      "Ein gespeicherter Trainingstag zählt einmal, auch bei mehreren Einträgen.",
    ),
    insight(
      33,
      "ziele",
      "Ziel für Fokus-Bestwert",
      `${formatNumber(goals.focusBestTarget)} ${focusUnit}`,
      `${focusMeta.name}; frei anpassbar.`,
    ),
    insight(
      34,
      "ziele",
      "Fortschritt zum Bestwert-Ziel",
      currentGoalProgress == null ? "—" : `${currentGoalProgress} %`,
      focusRows.length
        ? `Bestwert im gewählten Zeitraum: ${formatNumber(focusPersonalBest)} ${focusUnit} von ${formatNumber(goals.focusBestTarget)} ${focusUnit}.`
        : `Noch keine Fokus-Einträge im gewählten Zeitraum; Ziel: ${formatNumber(goals.focusBestTarget)} ${focusUnit}.`,
    ),
    insight(
      35,
      "ziele",
      "Nächste Etappe",
      focusRows.length
        ? `${formatNumber(Math.min(goals.focusBestTarget, Math.ceil((focusPersonalBest + 1) / 10) * 10))} ${focusUnit}`
        : "—",
      focusRows.length
        ? "Kleine Zwischenetappe in Richtung des selbst gesetzten Bestwert-Ziels."
        : "Im gewählten Zeitraum fehlen Fokus-Einträge.",
    ),
    insight(
      36,
      "ziele",
      "Bis zum Bestwert-Ziel",
      targetRemaining == null ? "—" : `${formatNumber(targetRemaining)} ${focusUnit}`,
      targetRemaining == null
        ? "Im gewählten Zeitraum fehlen Fokus-Einträge."
        : "Differenz zwischen dem Bestwert im gewählten Zeitraum und dem lokalen Ziel.",
    ),
    insight(
      37,
      "ziele",
      "Grobe Fortschrittsprojektion",
      targetRemaining === 0
        ? "Ziel erreicht"
        : targetEtaWeeks == null
          ? "—"
          : `${targetEtaWeeks} Wochen`,
      goalPace,
    ),
    insight(38, "ziele", "Eigenes Zieldatum", targetDateValue, targetDateNote),
    insight(
      39,
      "ziele",
      "Zieldatum-Puffer",
      targetDateDelta == null ? "—" : formatDurationDays(Math.abs(targetDateDelta)),
      targetDateDelta == null
        ? "Lege optional ein Datum fest."
        : targetDateDelta < 0
          ? "Vergangenes Datum; ohne Druck aktualisieren."
          : "Kalendertage bis zum gewählten Datum.",
    ),
    insight(
      40,
      "ziele",
      "Ziele gespeichert",
      "Lokal auf diesem Gerät",
      "Kein Datenbankeintrag und keine Synchronisierung mit anderen Geräten.",
    ),

    insight(
      41,
      "coaching",
      "Wiederholungen diese Woche",
      formatNumber(last7Reps),
      "Nur tatsächlich gespeicherte Wiederholungs-Einheiten.",
    ),
    insight(
      42,
      "coaching",
      "Wochenvergleich",
      weeklyChange,
      "Letzte 7 Tage gegenüber den vorherigen 7 Tagen.",
    ),
    insight(
      43,
      "coaching",
      "Fokus-Bestwert-Trend",
      focusBestTrend,
      "Höchster Einzelwert der letzten 14 Tage gegenüber den vorherigen 14 Tagen; kein Gesamtvolumen.",
    ),
    insight(
      44,
      "coaching",
      "Wiederholungen pro aktivem Tag",
      formatNumber(repetitionsPerActiveDay),
      "Nur Tage mit mindestens einer wiederholungsbasierten Übung zählen.",
    ),
    insight(
      45,
      "coaching",
      "Zeit seit letzter Einheit",
      daysSinceLast == null ? "—" : formatDurationDays(daysSinceLast),
      daysSinceLast == null
        ? "Noch keine gespeicherten Einträge."
        : `Letzter Eintrag: ${formatDay(mostRecent?.day ?? null)}.`,
    ),
    insight(
      46,
      "coaching",
      "Nächster Schritt",
      trainingRecommendation,
      "Orientierung anhand gespeicherter Einträge; kein medizinischer oder verpflichtender Trainingsrat.",
    ),
    insight(
      47,
      "coaching",
      "Bevorzugtes Trainingsfenster",
      preferredTimeWindow
        ? `${preferredTimeWindow.label} · ${preferredTimeWindow.count} Einheiten`
        : "—",
      "Häufigstes Fenster aus gespeicherten lokalen Uhrzeiten: morgens vor 12, nachmittags 12–16, abends ab 17 Uhr.",
    ),
    insight(
      48,
      "coaching",
      "Einheiten nach letztem Fokus-Bestwert",
      sessionsSinceBest == null ? "—" : formatNumber(sessionsSinceBest),
      "Gespeicherte Einträge der Fokus-Übung nach dem jüngsten Erreichen des Bestwerts im gewählten Zeitraum.",
    ),
    insight(
      49,
      "coaching",
      "Datenqualität",
      dataCoverage,
      "Ungültige Zeitstempel, Übungs-IDs oder Zählwerte werden nicht in Kennzahlen übernommen.",
    ),
    insight(
      50,
      "coaching",
      "Kurzzusammenfassung",
      progressSummary,
      "Berechnet ausschließlich im Browser aus dem bereits geladenen Verlauf; keine neue DB-Schreiboperation.",
    ),
  ];

  return items;
}

export function trainingStudioGroups(
  insights: readonly TrainingStudioInsight[],
): Array<{ id: TrainingStudioGroupId; label: string; insights: TrainingStudioInsight[] }> {
  return GROUP_ORDER.map((id) => ({
    id,
    label: trainingStudioGroupLabel(id),
    insights: insights.filter((item) => item.group === id),
  }));
}
