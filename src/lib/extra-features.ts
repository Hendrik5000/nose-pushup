/** Small feature stores: water, mood, favorites, notes, step goals, PR toasts. */

const WATER_KEY = "np-water";
const MOOD_KEY = "np-mood";
const FAV_KEY = "np-fav-exercises";
const NOTES_KEY = "np-workout-notes";
const STEPS_GOAL_KEY = "np-steps-goal";
const SEEN_PR_KEY = "np-seen-prs";

const today = () => new Date().toISOString().slice(0, 10);

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readJson<T>(key: string, fallback: T): T {
  if (!canUseStorage()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota / private mode
  }
}

// ——— Water ———
export function getWaterMl(day = today()): number {
  const all = readJson<Record<string, number>>(WATER_KEY, {});
  return all[day] ?? 0;
}

export function addWaterMl(amount: number, day = today()): number {
  const all = readJson<Record<string, number>>(WATER_KEY, {});
  all[day] = Math.max(0, (all[day] ?? 0) + amount);
  writeJson(WATER_KEY, all);
  return all[day];
}

export function setWaterMl(ml: number, day = today()): number {
  const all = readJson<Record<string, number>>(WATER_KEY, {});
  all[day] = Math.max(0, ml);
  writeJson(WATER_KEY, all);
  return all[day];
}

export const WATER_GOAL_ML = 2500;

// ——— Mood ———
export type MoodLevel = 1 | 2 | 3 | 4 | 5;

export function getMood(day = today()): MoodLevel | null {
  const all = readJson<Record<string, number>>(MOOD_KEY, {});
  const v = all[day];
  return v >= 1 && v <= 5 ? (v as MoodLevel) : null;
}

export function setMood(level: MoodLevel, day = today()) {
  const all = readJson<Record<string, number>>(MOOD_KEY, {});
  all[day] = level;
  writeJson(MOOD_KEY, all);
}

export const MOOD_LABELS: Record<MoodLevel, string> = {
  1: "Schwer",
  2: "Mäßig",
  3: "Okay",
  4: "Gut",
  5: "Top",
};

export const MOOD_EMOJI: Record<MoodLevel, string> = {
  1: "😫",
  2: "😕",
  3: "😐",
  4: "🙂",
  5: "🔥",
};

// ——— Favorites ———
export function getFavoriteExercises(): string[] {
  const v = readJson<string[]>(FAV_KEY, []);
  return Array.isArray(v) ? v : [];
}

export function toggleFavoriteExercise(id: string): string[] {
  const cur = getFavoriteExercises();
  const next = cur.includes(id) ? cur.filter((x) => x !== id) : [id, ...cur].slice(0, 12);
  writeJson(FAV_KEY, next);
  return next;
}

export function isFavoriteExercise(id: string): boolean {
  return getFavoriteExercises().includes(id);
}

// ——— Workout notes ———
export type WorkoutNote = { id: string; text: string; ts: string; exerciseId?: string };

export function getWorkoutNotes(): WorkoutNote[] {
  const v = readJson<WorkoutNote[]>(NOTES_KEY, []);
  return Array.isArray(v) ? v : [];
}

export function addWorkoutNote(text: string, exerciseId?: string): WorkoutNote {
  const note: WorkoutNote = {
    id: `${Date.now().toString(36)}`,
    text: text.trim().slice(0, 500),
    ts: new Date().toISOString(),
    exerciseId,
  };
  const list = [note, ...getWorkoutNotes()].slice(0, 50);
  writeJson(NOTES_KEY, list);
  return note;
}

export function deleteWorkoutNote(id: string) {
  writeJson(
    NOTES_KEY,
    getWorkoutNotes().filter((n) => n.id !== id),
  );
}

// ——— Weekly steps goal ———
export function getStepsGoal(): number {
  if (!canUseStorage()) return 8000;
  try {
    const v = parseInt(window.localStorage.getItem(STEPS_GOAL_KEY) || "8000", 10);
    return Number.isFinite(v) ? Math.max(1000, Math.min(50000, v)) : 8000;
  } catch {
    return 8000;
  }
}

export function setStepsGoal(n: number) {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(STEPS_GOAL_KEY, String(Math.max(1000, Math.min(50000, n))));
  } catch {
    // ignore
  }
}

// ——— Sleep debt ———
export function sleepDebtHours(sleepMinLast7: number[]): number {
  if (!sleepMinLast7.length) return 0;
  const target = 8 * 60;
  const debt = sleepMinLast7.reduce((acc, m) => acc + Math.max(0, target - m), 0);
  return Math.round((debt / 60) * 10) / 10;
}

// ——— PR toast tracking ———
export function shouldCelebratePr(key: string): boolean {
  const seen = readJson<Record<string, boolean>>(SEEN_PR_KEY, {});
  if (seen[key]) return false;
  seen[key] = true;
  writeJson(SEEN_PR_KEY, seen);
  return true;
}
