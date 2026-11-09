import { getAloOwner, listAlo, putAlo, removeAlo } from "@/lib/alo-store";
/** Small feature stores: water, mood, favorites, notes, step goals, PR toasts. */

const WATER_KEY = "np-water";
const MOOD_KEY = "np-mood";
const FAV_KEY = "np-fav-exercises";
const NOTES_KEY = "np-workout-notes";
const STEPS_GOAL_KEY = "np-steps-goal";
const SEEN_PR_KEY = "np-seen-prs";

const today = () => new Date().toISOString().slice(0, 10);
// Older global keys cannot be safely attributed to one account, so never read them as a fallback.
const trackerKey = (base: string, userId: string) =>
  `${base}:${encodeURIComponent(userId || "unassigned")}`;

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

function writeJson(key: string, value: unknown): boolean {
  if (!canUseStorage()) return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // quota / private mode
    return false;
  }
}

// ——— Water ———
export function getWaterMl(userId: string, day = today()): number {
  const all = readJson<Record<string, number>>(trackerKey(WATER_KEY, userId), {});
  return all[day] ?? 0;
}

export function addWaterMl(userId: string, amount: number, day = today()): number | null {
  if (!Number.isFinite(amount)) return null;
  const key = trackerKey(WATER_KEY, userId);
  const all = readJson<Record<string, number>>(key, {});
  all[day] = Math.max(0, (all[day] ?? 0) + amount);
  return writeJson(key, all) ? all[day] : null;
}

export function parseWaterAmount(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const amount = Number(raw);
  return Number.isSafeInteger(amount) && amount >= 10 && amount <= 2000 ? amount : null;
}

export function undoWaterMl(userId: string, amount: number, day = today()): number | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return setWaterMl(userId, getWaterMl(userId, day) - amount, day);
}

export function setWaterMl(userId: string, ml: number, day = today()): number | null {
  if (!Number.isFinite(ml)) return null;
  const key = trackerKey(WATER_KEY, userId);
  const all = readJson<Record<string, number>>(key, {});
  all[day] = Math.max(0, ml);
  return writeJson(key, all) ? all[day] : null;
}

export const WATER_GOAL_ML = 2500;

// ——— Mood ———
export type MoodLevel = 1 | 2 | 3 | 4 | 5;

export function getMood(userId: string, day = today()): MoodLevel | null {
  const all = readJson<Record<string, number>>(trackerKey(MOOD_KEY, userId), {});
  const v = all[day];
  return v >= 1 && v <= 5 ? (v as MoodLevel) : null;
}

export function setMood(userId: string, level: MoodLevel, day = today()): boolean {
  const key = trackerKey(MOOD_KEY, userId);
  const all = readJson<Record<string, number>>(key, {});
  all[day] = level;
  return writeJson(key, all);
}

export function clearMood(userId: string, day = today()): boolean {
  const key = trackerKey(MOOD_KEY, userId);
  const all = readJson<Record<string, number>>(key, {});
  if (!Object.hasOwn(all, day)) return false;
  delete all[day];
  return writeJson(key, all);
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

export function toggleFavoriteExercise(id: string): string[] | null {
  const cur = getFavoriteExercises();
  const next = cur.includes(id) ? cur.filter((x) => x !== id) : [id, ...cur].slice(0, 12);
  return writeJson(FAV_KEY, next) ? next : null;
}

export function isFavoriteExercise(id: string): boolean {
  return getFavoriteExercises().includes(id);
}

// ——— Workout notes ———
export type WorkoutNote = {
  id: string;
  text: string;
  ts: string;
  exerciseId?: string;
  updatedAt?: string;
};
export const MAX_WORKOUT_NOTE_LENGTH = 500;

export function filterWorkoutNotes(notes: readonly WorkoutNote[], query: string): WorkoutNote[] {
  const normalized = query.trim().toLocaleLowerCase("de-DE");
  return normalized
    ? notes.filter((note) => note.text.toLocaleLowerCase("de-DE").includes(normalized))
    : [...notes];
}

export function getWorkoutNotes(): WorkoutNote[] {
  if (getAloOwner())
    return listAlo("note")
      .map((r) => r.body as unknown as WorkoutNote)
      .sort((a, b) => (b.updatedAt ?? b.ts).localeCompare(a.updatedAt ?? a.ts));
  const v = readJson<WorkoutNote[]>(NOTES_KEY, []);
  return Array.isArray(v)
    ? v.sort((a, b) => (b.updatedAt ?? b.ts).localeCompare(a.updatedAt ?? a.ts))
    : [];
}

export function addWorkoutNote(text: string, exerciseId?: string): WorkoutNote | null {
  const note: WorkoutNote = {
    id: crypto.randomUUID(),
    text: text.trim().slice(0, MAX_WORKOUT_NOTE_LENGTH),
    ts: new Date().toISOString(),
    exerciseId,
  };
  const owner = getAloOwner();
  if (owner) {
    try {
      putAlo("note", note as unknown as Record<string, unknown>, `note:${note.id}`, owner);
      return note;
    } catch {
      return null;
    }
  }
  const list = [note, ...getWorkoutNotes()].slice(0, 50);
  return writeJson(NOTES_KEY, list) ? note : null;
}

export function deleteWorkoutNote(id: string) {
  if (getAloOwner()) {
    removeAlo(`note:${id}`);
    return;
  }
  writeJson(
    NOTES_KEY,
    getWorkoutNotes().filter((n) => n.id !== id),
  );
}

export function updateWorkoutNote(id: string, text: string): boolean {
  const normalized = text.trim();
  if (!normalized || normalized.length > MAX_WORKOUT_NOTE_LENGTH) return false;
  const notes = getWorkoutNotes();
  const note = notes.find((entry) => entry.id === id);
  if (!note) return false;
  const updated = { ...note, text: normalized, updatedAt: new Date().toISOString() };
  const owner = getAloOwner();
  if (owner) {
    try {
      putAlo("note", updated as unknown as Record<string, unknown>, `note:${id}`, owner);
      return true;
    } catch {
      return false;
    }
  }
  return writeJson(
    NOTES_KEY,
    notes.map((entry) => (entry.id === id ? updated : entry)),
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
