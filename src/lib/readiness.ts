// ─── Readiness-Score ──────────────────────────────────────────────────────────
// Täglicher Gesamtscore (0–100) aus Schlaf, Schritten, Check-in (Energie/
// Schmerzen), Trainingslast der letzten 7 Tage und Streak.
// Wird von Startseite, Coach-Plan und Cali-Hub gemeinsam genutzt.

import { loadCheckin, loadRecentCheckins, getTodayKey } from "./calisthenics";

export type ReadinessLevel = "green" | "yellow" | "red";

export type ReadinessInput = {
  sleepMin: number | null;      // heute, aus health_entries
  steps: number | null;         // heute
  workoutsLast7Days: number;    // Anzahl Workouts
  streak: number;
};

export type Readiness = {
  score: number;                // 0–100
  level: ReadinessLevel;
  emoji: string;
  label: string;
  detail: string;
};

export function computeReadiness(input: ReadinessInput): Readiness {
  const checkin = loadCheckin(getTodayKey());

  // Schlaf: 0–30 Punkte (8h = voll)
  const sleepPts =
    input.sleepMin == null ? 15 : Math.min(30, Math.round((input.sleepMin / 480) * 30));

  // Energie/Schmerzen aus dem Check-in: 0–30 Punkte
  let checkinPts = 15; // neutral, wenn kein Check-in
  if (checkin) {
    checkinPts = Math.round(((checkin.energy - 1) / 4) * 20 + ((5 - checkin.soreness) / 4) * 10);
  }

  // Trainingslast: 0–25 Punkte — 3–5 Sessions/Woche optimal, >6 zu viel
  const w = input.workoutsLast7Days;
  const loadPts = w === 0 ? 8 : w <= 2 ? 18 : w <= 5 ? 25 : w === 6 ? 18 : 10;

  // Streak-Bonus: 0–15 Punkte
  const streakPts = Math.min(15, input.streak * 2);

  const score = Math.max(0, Math.min(100, sleepPts + checkinPts + loadPts + streakPts));

  if (score >= 70) {
    return {
      score,
      level: "green",
      emoji: "🟢",
      label: "Vollgas",
      detail: "Optimale Trainingsbereitschaft — heute kannst du an deine Grenzen gehen.",
    };
  }
  if (score >= 45) {
    return {
      score,
      level: "yellow",
      emoji: "🟡",
      label: "Moderat",
      detail: "Solide Basis — Technik-Training oder moderates Volumen passt heute am besten.",
    };
  }
  return {
    score,
    level: "red",
    emoji: "🔴",
    label: "Regenerieren",
    detail: "Dein Körper braucht Erholung — Mobilität, Stretching oder ein Spaziergang reichen heute.",
  };
}

// ─── Verlauf (lokal, letzte 14 Tage) ─────────────────────────────────────────

const HISTORY_KEY = "np-readiness-history";

type HistoryEntry = { day: string; score: number };

export function recordReadiness(score: number): void {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const list: HistoryEntry[] = raw ? JSON.parse(raw) : [];
    const today = getTodayKey();
    const next = list.filter((e) => e.day !== today);
    next.push({ day: today, score });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next.slice(-14)));
  } catch {
    /* ignore */
  }
}

export function readinessHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

/** Durchschnittliche Energie/Schmerzen der letzten N Check-ins (für Coach-Kontext). */
export function checkinAverages(days = 7): { energy: number; soreness: number } | null {
  const list = loadRecentCheckins(days);
  if (!list.length) return null;
  return {
    energy: list.reduce((s, c) => s + c.energy, 0) / list.length,
    soreness: list.reduce((s, c) => s + c.soreness, 0) / list.length,
  };
}
