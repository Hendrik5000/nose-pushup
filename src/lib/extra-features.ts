/** Small feature stores: water, mood, favorites, notes, step goals, PR toasts. */

const WATER_KEY = "np-water";
const MOOD_KEY = "np-mood";
const FAV_KEY = "np-fav-exercises";
const NOTES_KEY = "np-workout-notes";
const STEPS_GOAL_KEY = "np-steps-goal";
const SEEN_PR_KEY = "np-seen-prs";

const today = () => new Date().toISOString().slice(0, 10);

// ——— Water ———
export function getWaterMl(day = today()): number {
  try {
    const all = JSON.parse(localStorage.getItem(WATER_KEY) || "{}") as Record<string, number>;
    return all[day] ?? 0;
  } catch {
    return 0;
  }
}

export function addWaterMl(amount: number, day = today()): number {
  const all = (() => {
    try {
      return JSON.parse(localStorage.getItem(WATER_KEY) || "{}") as Record<string, number>;
    } catch {
      return {};
    }
  })();
  all[day] = Math.max(0, (all[day] ?? 0) + amount);
  localStorage.setItem(WATER_KEY, JSON.stringify(all));
  return all[day];
}

export function setWaterMl(ml: number, day = today()): number {
  const all = (() => {
    try {
      return JSON.parse(localStorage.getItem(WATER_KEY) || "{}") as Record<string, number>;
    } catch {
      return {};
    }
  })();
  all[day] = Math.max(0, ml);
  localStorage.setItem(WATER_KEY, JSON.stringify(all));
  return all[day];
}

export const WATER_GOAL_ML = 2500;

// ——— Mood ———
export type MoodLevel = 1 | 2 | 3 | 4 | 5;

export function getMood(day = today()): MoodLevel | null {
  try {
    const all = JSON.parse(localStorage.getItem(MOOD_KEY) || "{}") as Record<string, number>;
    const v = all[day];
    return v >= 1 && v <= 5 ? (v as MoodLevel) : null;
  } catch {
    return null;
  }
}

export function setMood(level: MoodLevel, day = today()) {
  const all = (() => {
    try {
      return JSON.parse(localStorage.getItem(MOOD_KEY) || "{}") as Record<string, number>;
    } catch {
      return {};
    }
  })();
  all[day] = level;
  localStorage.setItem(MOOD_KEY, JSON.stringify(all));
}

export const MOOD_LABELS: Record<MoodLevel, string> = {
  1: "Schwer",
  2: "Mausig",
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
  try {
    const v = JSON.parse(localStorage.getItem(FAV_KEY) || "[]") as string[];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function toggleFavoriteExercise(id: string): string[] {
  const cur = getFavoriteExercises();
  const next = cur.includes(id) ? cur.filter((x) => x !== id) : [id, ...cur].slice(0, 12);
  localStorage.setItem(FAV_KEY, JSON.stringify(next));
  return next;
}

export function isFavoriteExercise(id: string): boolean {
  return getFavoriteExercises().includes(id);
}

// ——— Workout notes ———
export type WorkoutNote = { id: string; text: string; ts: string; exerciseId?: string };

export function getWorkoutNotes(): WorkoutNote[] {
  try {
    const v = JSON.parse(localStorage.getItem(NOTES_KEY) || "[]") as WorkoutNote[];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function addWorkoutNote(text: string, exerciseId?: string): WorkoutNote {
  const note: WorkoutNote = {
    id: `${Date.now().toString(36)}`,
    text: text.trim().slice(0, 500),
    ts: new Date().toISOString(),
    exerciseId,
  };
  const list = [note, ...getWorkoutNotes()].slice(0, 50);
  localStorage.setItem(NOTES_KEY, JSON.stringify(list));
  return note;
}

export function deleteWorkoutNote(id: string) {
  localStorage.setItem(
    NOTES_KEY,
    JSON.stringify(getWorkoutNotes().filter((n) => n.id !== id)),
  );
}

// ——— Weekly steps goal ———
export function getStepsGoal(): number {
  try {
    const v = parseInt(localStorage.getItem(STEPS_GOAL_KEY) || "8000", 10);
    return Number.isFinite(v) ? Math.max(1000, Math.min(50000, v)) : 8000;
  } catch {
    return 8000;
  }
}

export function setStepsGoal(n: number) {
  localStorage.setItem(STEPS_GOAL_KEY, String(Math.max(1000, Math.min(50000, n))));
}

// ——— Sleep debt (hours vs 8h target over last nights) ———
export function sleepDebtHours(sleepMinLast7: number[]): number {
  if (!sleepMinLast7.length) return 0;
  const target = 8 * 60;
  const debt = sleepMinLast7.reduce((acc, m) => acc + Math.max(0, target - m), 0);
  return Math.round((debt / 60) * 10) / 10;
}

// ——— PR toast tracking ———
export function shouldCelebratePr(key: string): boolean {
  try {
    const seen = JSON.parse(localStorage.getItem(SEEN_PR_KEY) || "{}") as Record<string, boolean>;
    if (seen[key]) return false;
    seen[key] = true;
    localStorage.setItem(SEEN_PR_KEY, JSON.stringify(seen));
    return true;
  } catch {
    return true;
  }
}
