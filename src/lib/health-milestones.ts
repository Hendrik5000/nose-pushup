/**
 * Gesundheits-Meilensteine aus den bereits geladenen Einträgen (Feature-Lauf 15.11.2026).
 * Rein clientseitig; keine Speicherung, keine DB-Änderung.
 */

export type HealthExportEntry = {
  day: string;
  steps: number;
  active_kcal: number;
  weight_kg: number | null;
  sleep_min: number;
  source: string;
};

export type HealthMilestone = {
  id: string;
  label: string;
  achieved: boolean;
  achievedOn: string | null;
};

function firstDayReaching(
  entries: HealthExportEntry[],
  valueOf: (entry: HealthExportEntry) => number,
  threshold: number,
): string | null {
  const sorted = [...entries].sort((a, b) => a.day.localeCompare(b.day));
  for (const entry of sorted) {
    if (valueOf(entry) >= threshold) return entry.day;
  }
  return null;
}

export function evaluateHealthMilestones(entries: HealthExportEntry[]): HealthMilestone[] {
  const stepValues = entries.map((e) => Math.max(0, e.steps));
  const kcalValues = entries.map((e) => Math.max(0, e.active_kcal));
  const sleepNights = entries.filter((e) => e.sleep_min > 0);
  const weightLogs = entries.filter((e) => e.weight_kg != null);
  const bestSteps = stepValues.length ? Math.max(...stepValues) : 0;
  const bestKcal = kcalValues.length ? Math.max(...kcalValues) : 0;
  const totalSteps = stepValues.reduce((sum, v) => sum + v, 0);

  const defs: { id: string; label: string; achieved: boolean; achievedOn: string | null }[] = [
    {
      id: "steps-10k",
      label: "10.000 Schritte an einem Tag",
      achieved: bestSteps >= 10000,
      achievedOn: firstDayReaching(entries, (e) => e.steps, 10000),
    },
    {
      id: "steps-100k",
      label: "100.000 Schritte insgesamt",
      achieved: totalSteps >= 100000,
      achievedOn: totalSteps >= 100000 ? null : null,
    },
    {
      id: "kcal-500",
      label: "500 aktive kcal an einem Tag",
      achieved: bestKcal >= 500,
      achievedOn: firstDayReaching(entries, (e) => e.active_kcal, 500),
    },
    {
      id: "sleep-7",
      label: "7 Nächte mit Schlaf erfasst",
      achieved: sleepNights.length >= 7,
      achievedOn: sleepNights.length >= 7 ? (sleepNights[6]?.day ?? null) : null,
    },
    {
      id: "weight-10",
      label: "10 Gewichtseinträge dokumentiert",
      achieved: weightLogs.length >= 10,
      achievedOn: weightLogs.length >= 10 ? (weightLogs[9]?.day ?? null) : null,
    },
  ];
  return defs;
}
