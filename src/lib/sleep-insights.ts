/**
 * Schlaf-Insights aus den geladenen Einträgen (Feature-Lauf 15.11.2026).
 * Rein clientseitig; keine Speicherung, keine DB-Änderung.
 */

export type SleepEntry = { day: string; sleep_min: number };

export type SleepInsights = {
  nights: number;
  averageHours: number | null;
  bestNight: { day: string; hours: number } | null;
  shortestNight: { day: string; hours: number } | null;
  consistency: "unbekannt" | "regelmäßig" | "variabel";
  message: string;
};

export function summarizeSleep(entries: SleepEntry[]): SleepInsights {
  const nights = entries
    .filter((e) => e.sleep_min > 0)
    .map((e) => ({ day: e.day, hours: e.sleep_min / 60 }))
    .sort((a, b) => a.day.localeCompare(b.day));

  if (nights.length === 0) {
    return {
      nights: 0,
      averageHours: null,
      bestNight: null,
      shortestNight: null,
      consistency: "unbekannt",
      message: "Noch keine Schlafdaten erfasst.",
    };
  }

  const total = nights.reduce((sum, n) => sum + n.hours, 0);
  const average = total / nights.length;
  const best = nights.reduce((a, b) => (b.hours > a.hours ? b : a));
  const shortest = nights.reduce((a, b) => (b.hours < a.hours ? b : a));
  const variance =
    nights.reduce((sum, n) => sum + (n.hours - average) ** 2, 0) / nights.length;
  const stdDev = Math.sqrt(variance);
  const consistency: SleepInsights["consistency"] =
    nights.length < 3 ? "unbekannt" : stdDev <= 1 ? "regelmäßig" : "variabel";

  const message =
    nights.length < 3
      ? `Erste Einblicke ab drei erfassten Nächten (${nights.length} bisher).`
      : consistency === "regelmäßig"
        ? `Dein Schlaf ist mit Ø ${average.toFixed(1)} h ziemlich regelmäßig.`
        : `Dein Schlaf schwankt zwischen ${shortest.hours.toFixed(1)} h und ${best.hours.toFixed(1)} h.`;

  return {
    nights: nights.length,
    averageHours: Math.round(average * 10) / 10,
    bestNight: { day: best.day, hours: Math.round(best.hours * 10) / 10 },
    shortestNight: { day: shortest.day, hours: Math.round(shortest.hours * 10) / 10 },
    consistency,
    message,
  };
}
