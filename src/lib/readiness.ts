// ─── Readiness-Score ──────────────────────────────────────────────────────────
// Täglicher Gesamtscore aus account-boundem Schlaf, Trainingslast und Streak.

import { localDateKey } from "./training-dates";

export type ReadinessLevel = "green" | "yellow" | "red";

export type ReadinessInput = {
  sleepMin: number | null; // heute, aus health_entries
  steps: number | null; // heute
  workoutsLast7Days: number | null; // Anzahl gespeicherter Workouts; null bei Abfragefehler
  streak: number;
};

export type Readiness = {
  score: number; // 0–100
  level: ReadinessLevel;
  emoji: string;
  label: string;
  detail: string;
  available: boolean;
  dataCoverage: number;
  sources: string[];
  missingSources: string[];
};

export function computeReadiness(input: ReadinessInput): Readiness {
  const sources: string[] = [];
  const missingSources: string[] = [];
  if (
    input.sleepMin != null &&
    Number.isFinite(input.sleepMin) &&
    input.sleepMin >= 0 &&
    input.sleepMin <= 1440
  )
    sources.push("Schlaf");
  else missingSources.push("Schlaf");
  if (
    input.workoutsLast7Days != null &&
    Number.isInteger(input.workoutsLast7Days) &&
    input.workoutsLast7Days > 0
  )
    sources.push("Workouts der letzten 7 Tage");
  else missingSources.push("Workouts der letzten 7 Tage");

  // Require at least two independent, real inputs. A streak alone is not evidence
  // of recovery; keep the numeric field for compatibility, but mark it unavailable.
  if (sources.length < 2) {
    return {
      score: 0,
      level: "yellow",
      emoji: "ℹ️",
      label: "Noch nicht genug Daten",
      detail:
        "Für eine Readiness-Einschätzung brauchen wir mindestens zwei Datenquellen, beide an dein Konto gebunden: Schlaf und gespeicherte Workouts der letzten 7 Tage.",
      available: false,
      dataCoverage: sources.length,
      sources,
      missingSources,
    };
  }

  // Schlaf: 0–30 Punkte (8h = voll); fehlende Quellen werden nicht neutral erfunden.
  const sleepPts =
    input.sleepMin == null ? null : Math.min(30, Math.round((input.sleepMin / 480) * 30));

  // Trainingslast: 0–25 Punkte — 3–5 Sessions/Woche optimal, >6 zu viel
  const w = input.workoutsLast7Days;
  const loadPts = w == null ? null : w === 0 ? 8 : w <= 2 ? 18 : w <= 5 ? 25 : w === 6 ? 18 : 10;

  // Streak-Bonus: 0–15 Punkte
  const streakPts = Number.isFinite(input.streak) ? Math.max(0, Math.min(15, input.streak * 2)) : 0;

  const knownPoints = (sleepPts ?? 0) + (loadPts ?? 0) + streakPts;
  const knownMaximum = (sleepPts == null ? 0 : 30) + (loadPts == null ? 0 : 25) + 15;
  const score = Math.max(0, Math.min(100, Math.round((knownPoints / knownMaximum) * 100)));
  const coverageNote = `Berechnet aus ${sources.join(", ")}${missingSources.length ? `; nicht vorhanden: ${missingSources.join(", ")}` : ""}. Streak-Bonus fließt mit ein.`;

  if (score >= 70) {
    return {
      score,
      level: "green",
      emoji: "🟢",
      label: "Vollgas",
      detail: `Gute Tendenz aus den vorhandenen Daten. Höre trotzdem auf dein Körpergefühl. ${coverageNote}`,
      available: true,
      dataCoverage: sources.length,
      sources,
      missingSources,
    };
  }
  if (score >= 45) {
    return {
      score,
      level: "yellow",
      emoji: "🟡",
      label: "Moderat",
      detail: `Eingeschränkte Einschätzung — moderates Training ist eine vorsichtige Option. ${coverageNote}`,
      available: true,
      dataCoverage: sources.length,
      sources,
      missingSources,
    };
  }
  return {
    score,
    level: "red",
    emoji: "🔴",
    label: "Regenerieren",
    detail: `Niedriger Wert in den erfassten Daten — erwäge eine lockere Einheit. ${coverageNote}`,
    available: true,
    dataCoverage: sources.length,
    sources,
    missingSources,
  };
}

// ─── Verlauf (pro Konto lokal auf diesem Gerät, letzte 14 Tage) ───────────────

const HISTORY_KEY = "np-readiness-history";

type HistoryEntry = { day: string; score: number };

export function recordReadiness(score: number, userId = "local"): void {
  try {
    const key = `${HISTORY_KEY}:${encodeURIComponent(userId)}`;
    const raw = localStorage.getItem(key);
    const list: HistoryEntry[] = raw ? JSON.parse(raw) : [];
    const today = localDateKey(new Date());
    const next = list.filter((e) => e.day !== today);
    next.push({ day: today, score });
    localStorage.setItem(key, JSON.stringify(next.slice(-14)));
  } catch {
    /* ignore */
  }
}

export function readinessHistory(userId = "local"): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(`${HISTORY_KEY}:${encodeURIComponent(userId)}`);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}
