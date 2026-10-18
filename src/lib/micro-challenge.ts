// ─── Daily Micro-Challenge ───────────────────────────────────────────────────
// One small, personalised goal per day. Generated client-side from readiness,
// personal bests and streak so it stays relevant without a DB migration.
// Completion is persisted in localStorage (keyed by day).

import { getTodayKey } from "./calisthenics";
import type { ReadinessLevel } from "./readiness";

export type MicroUnit = "reps" | "seconds" | "workouts";

export type MicroChallenge = {
  /** Stable id for the day, e.g. "2026-10-18:pushups-20". */
  id: string;
  title: string;
  description: string;
  icon: string;
  /** Exercise to deep-link into; null = any workout counts. */
  exerciseId: string | null;
  target: number;
  unit: MicroUnit;
  xpReward: number;
  difficulty: "easy" | "medium" | "hard";
};

export type MicroProgress = {
  day: string;
  challengeId: string;
  progress: number;
  completed: boolean;
  xpClaimed: boolean;
};

export type MicroInput = {
  pushupBest: number;
  dailyGoal: number;
  todayReps: number;
  /** Number of workouts logged today (any exercise). */
  todayWorkouts: number;
  streak: number;
  readinessLevel: ReadinessLevel;
  /** Optional: best for plank in seconds. */
  plankBest?: number;
};

const STORAGE_KEY = "np-micro-challenge";

// ─── Seeded variety ───────────────────────────────────────────────────────────

/** Deterministic 0..n-1 from date string so the same day always gets the same variant. */
function daySeed(day: string): number {
  let h = 0;
  for (let i = 0; i < day.length; i++) h = (h * 31 + day.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// ─── Challenge generation ─────────────────────────────────────────────────────

export function generateMicroChallenge(input: MicroInput, day = getTodayKey()): MicroChallenge {
  const seed = daySeed(day);
  const best = Math.max(5, input.pushupBest || 10);
  const goal = Math.max(20, input.dailyGoal || 50);

  // Scale difficulty by readiness
  const scale =
    input.readinessLevel === "green" ? 1.0 : input.readinessLevel === "yellow" ? 0.75 : 0.5;

  type Candidate = Omit<MicroChallenge, "id">;
  const candidates: Candidate[] = [];

  // 1) Push-up volume (most common)
  const pushTarget = Math.max(8, Math.round(Math.min(best * 0.6, goal * 0.4) * scale));
  candidates.push({
    title: `${pushTarget} Push-Ups`,
    description: `Schaffe heute mindestens ${pushTarget} Push-Ups — sauber zählt doppelt.`,
    icon: "💪",
    exerciseId: "pushup",
    target: pushTarget,
    unit: "reps",
    xpReward: 25 + Math.round(pushTarget / 2),
    difficulty: pushTarget >= best * 0.5 ? "medium" : "easy",
  });

  // 2) Single-set challenge (beat a fraction of PB)
  const setTarget = Math.max(5, Math.round(best * 0.45 * scale));
  candidates.push({
    title: `Satz von ${setTarget}`,
    description: `Mindestens ${setTarget} Push-Ups in einem Durchgang.`,
    icon: "🔥",
    exerciseId: "pushup",
    target: setTarget,
    unit: "reps",
    xpReward: 35 + Math.round(setTarget / 2),
    difficulty: "medium",
  });

  // 3) Just show up
  candidates.push({
    title: "Einfach starten",
    description: "Logge heute irgendein Workout — Streak schützen zählt.",
    icon: "✅",
    exerciseId: null,
    target: 1,
    unit: "workouts",
    xpReward: 20,
    difficulty: "easy",
  });

  // 4) Plank / timer (if we have a best or as fallback)
  const plankTarget = Math.max(20, Math.round((input.plankBest ?? 30) * 0.7 * scale));
  candidates.push({
    title: `${plankTarget}s Plank`,
    description: `Halte die Plank mindestens ${plankTarget} Sekunden.`,
    icon: "🧱",
    exerciseId: "plank",
    target: plankTarget,
    unit: "seconds",
    xpReward: 30,
    difficulty: "medium",
  });

  // 5) Daily goal progress
  const goalChunk = Math.max(15, Math.round(goal * 0.5 * scale));
  candidates.push({
    title: `${goalChunk} Richtung Tagesziel`,
    description: `Komm heute auf mindestens ${goalChunk} Push-Ups insgesamt.`,
    icon: "🎯",
    exerciseId: "pushup",
    target: goalChunk,
    unit: "reps",
    xpReward: 40,
    difficulty: goalChunk >= goal * 0.5 ? "hard" : "medium",
  });

  // On recovery days bias toward easy challenges
  let pool = candidates;
  if (input.readinessLevel === "red") {
    pool = candidates.filter((c) => c.difficulty === "easy" || c.unit === "workouts");
    if (pool.length === 0) pool = candidates;
  } else if (input.readinessLevel === "green" && input.streak >= 3) {
    // Prefer medium/hard when on a roll
    const hard = candidates.filter((c) => c.difficulty !== "easy");
    if (hard.length) pool = hard;
  }

  const pick = pool[seed % pool.length];
  return {
    ...pick,
    id: `${day}:${pick.exerciseId ?? "any"}-${pick.target}`,
  };
}

// ─── Progress helpers ─────────────────────────────────────────────────────────

export function loadMicroProgress(day = getTodayKey()): MicroProgress | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as MicroProgress;
    if (data.day !== day) return null;
    return data;
  } catch {
    return null;
  }
}

export function saveMicroProgress(p: MicroProgress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* ignore quota */
  }
}

/**
 * Compute current progress toward the challenge from live stats.
 * For unit "reps" we use todayReps (push-up volume).
 * For "workouts" we use todayWorkouts count.
 * For "seconds" the caller should pass the best single session of that exercise today
 * via `sessionBest` (falls back to 0).
 */
export function computeProgress(
  challenge: MicroChallenge,
  input: Pick<MicroInput, "todayReps" | "todayWorkouts">,
  sessionBest = 0,
): number {
  if (challenge.unit === "workouts") return Math.min(challenge.target, input.todayWorkouts);
  if (challenge.unit === "seconds") return Math.min(challenge.target, sessionBest);
  // reps — volume for the linked exercise (we only track push-up volume on the dashboard)
  return Math.min(challenge.target, input.todayReps);
}

export function ensureMicroProgress(
  challenge: MicroChallenge,
  input: Pick<MicroInput, "todayReps" | "todayWorkouts">,
  sessionBest = 0,
  day = getTodayKey(),
): MicroProgress {
  const existing = loadMicroProgress(day);
  const progress = computeProgress(challenge, input, sessionBest);
  const completed = progress >= challenge.target;

  // Keep xpClaimed sticky once true
  const xpClaimed = existing?.challengeId === challenge.id ? existing.xpClaimed : false;

  const next: MicroProgress = {
    day,
    challengeId: challenge.id,
    progress,
    completed,
    xpClaimed: xpClaimed || false,
  };

  // Persist when something meaningful changed
  if (
    !existing ||
    existing.challengeId !== next.challengeId ||
    existing.progress !== next.progress ||
    existing.completed !== next.completed
  ) {
    saveMicroProgress(next);
  }
  return next;
}

/** Mark XP as claimed after a successful profile update. */
export function markXpClaimed(day = getTodayKey()): void {
  const p = loadMicroProgress(day);
  if (!p || p.xpClaimed) return;
  saveMicroProgress({ ...p, xpClaimed: true });
}
