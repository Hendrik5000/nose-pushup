// XP <-> Level math + titles for the gamification system.
// Mirrors the DB function calc_level(xp).

export const MAX_LEVEL = 50;
export const XP_PER_REP = 10;
export const XP_PER_PLANK_SEC = 1;

export function xpToLevel(xp: number): number {
  const safe = Math.max(0, xp | 0);
  return Math.min(MAX_LEVEL, Math.max(1, Math.floor(Math.sqrt(safe / 100)) + 1));
}

/** XP threshold to *reach* the given level. Level 1 = 0 XP. */
export function levelToXp(level: number): number {
  const l = Math.max(1, Math.min(MAX_LEVEL, level));
  return Math.pow(l - 1, 2) * 100;
}

export function levelProgress(xp: number) {
  const level = xpToLevel(xp);
  const current = levelToXp(level);
  const next = level >= MAX_LEVEL ? current : levelToXp(level + 1);
  const span = Math.max(1, next - current);
  const into = Math.max(0, xp - current);
  return {
    level,
    title: levelTitle(level),
    xp,
    xpIntoLevel: into,
    xpForLevel: span,
    xpToNext: Math.max(0, next - xp),
    progress: Math.min(1, into / span),
    isMax: level >= MAX_LEVEL,
  };
}

const TITLES: Array<{ min: number; title: string }> = [
  { min: 1, title: "Beginner" },
  { min: 5, title: "Rookie" },
  { min: 10, title: "Athlete" },
  { min: 18, title: "Beast" },
  { min: 28, title: "Machine" },
  { min: 40, title: "Legend" },
  { min: 50, title: "Mythic" },
];

export function levelTitle(level: number): string {
  let t = TITLES[0].title;
  for (const entry of TITLES) if (level >= entry.min) t = entry.title;
  return t;
}
