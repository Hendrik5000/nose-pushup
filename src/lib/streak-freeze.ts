// ─── Streak Freeze ───────────────────────────────────────────────────────────
// Users get FREEZES_PER_MONTH freezes. Using one protects the streak for that day
// even without a workout. Stored in localStorage (no migration).

const KEY = "np-streak-freezes";
export const FREEZES_PER_MONTH = 2;

export type FreezeState = {
  /** YYYY-MM */
  month: string;
  /** Days already frozen this month (YYYY-MM-DD) */
  used: string[];
};

function monthKey(d = new Date()): string {
  return d.toISOString().slice(0, 7);
}

function todayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function loadFreezeState(): FreezeState {
  const month = monthKey();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { month, used: [] };
    const data = JSON.parse(raw) as FreezeState;
    if (data.month !== month) return { month, used: [] };
    return { month, used: Array.isArray(data.used) ? data.used : [] };
  } catch {
    return { month, used: [] };
  }
}

function saveFreezeState(s: FreezeState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function freezesRemaining(): number {
  const s = loadFreezeState();
  return Math.max(0, FREEZES_PER_MONTH - s.used.length);
}

export function isTodayFrozen(): boolean {
  const s = loadFreezeState();
  return s.used.includes(todayKey());
}

/** Activate a freeze for today. Returns false if none left or already frozen. */
export function activateFreezeToday(): boolean {
  const s = loadFreezeState();
  const today = todayKey();
  if (s.used.includes(today)) return false;
  if (s.used.length >= FREEZES_PER_MONTH) return false;
  s.used.push(today);
  saveFreezeState(s);
  return true;
}

/**
 * Whether the streak should still count as "active" for display purposes
 * when there was no workout yesterday/today but a freeze covers the gap.
 */
export function streakProtectedByFreeze(lastWorkoutDate: string | null): boolean {
  if (!lastWorkoutDate) return isTodayFrozen();
  const today = todayKey();
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (lastWorkoutDate === today || lastWorkoutDate === yesterday) return true;
  // If last workout was 2 days ago and yesterday was frozen, still ok for UI
  const twoDays = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
  if (lastWorkoutDate === twoDays) {
    const s = loadFreezeState();
    return s.used.includes(yesterday);
  }
  return isTodayFrozen();
}
