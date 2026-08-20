export type PlanDay = {
  day: string;
  focus: string;
  exercise_id: string | null;
  sets: number;
  reps: number;
  rest_s: number;
  note: string;
};

export type WeekPlan = {
  week_start: string;
  summary: string;
  days: PlanDay[];
  source: "ai" | "fallback";
};

const FOCUS_CYCLE = ["push", "core", "legs", "push", "mobility", "full", "rest"] as const;
const FOCUS_EXERCISE: Record<string, string | null> = {
  push: "pushup",
  core: "situp",
  legs: "squat",
  mobility: "plank",
  full: "burpee",
  rest: null,
};

export function mondayOf(d = new Date()): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dow);
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function fallbackPlan(
  weekStart: string,
  opts: { best: number; streak: number; weekReps: number; activeDays: number },
): WeekPlan {
  const base = Math.max(8, Math.round((opts.best || 10) * 0.75));
  // Sanft herunterfahren nach Pausen, steigern nach starker Woche.
  const factor = opts.activeDays >= 5 ? 1.15 : opts.activeDays <= 1 ? 0.7 : 1;
  const reps = Math.max(5, Math.min(60, Math.round(base * factor)));

  const days: PlanDay[] = FOCUS_CYCLE.map((focus, i) => ({
    day: addDays(weekStart, i),
    focus,
    exercise_id: FOCUS_EXERCISE[focus] ?? null,
    sets: focus === "rest" ? 0 : focus === "mobility" ? 2 : 3,
    reps: focus === "rest" ? 0 : focus === "mobility" ? 30 : reps,
    rest_s: focus === "rest" ? 0 : 60,
    note:
      focus === "rest"
        ? "Ruhetag – kurze Mobilität hält die Streak am Leben."
        : focus === "mobility"
          ? "Locker halten, sauber atmen."
          : "Saubere Form vor Tempo.",
  }));

  const summary =
    opts.activeDays <= 1
      ? "Sanfter Wiedereinstieg: kurze Sessions, dafür jeden Tag ein bisschen."
      : opts.activeDays >= 5
        ? "Starke Woche hinter dir – wir legen leicht drauf."
        : "Solide Basis: gleichmäßiges Volumen mit einem harten Tag.";

  return { week_start: weekStart, summary, days, source: "fallback" };
}

export function sanitizeDays(raw: unknown, weekStart: string): PlanDay[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: PlanDay[] = [];
  raw.slice(0, 7).forEach((r, i) => {
    const o = (r ?? {}) as Record<string, unknown>;
    const focus = typeof o["focus"] === "string" ? (o["focus"] as string).slice(0, 20) : "push";
    const ex = typeof o["exercise_id"] === "string" ? (o["exercise_id"] as string) : null;
    out.push({
      day: addDays(weekStart, i),
      focus,
      exercise_id:
        ex && ["pushup", "situp", "squat", "plank", "burpee"].includes(ex) ? ex : FOCUS_EXERCISE[focus] ?? null,
      sets: clamp(Number(o["sets"] ?? 3), 0, 12),
      reps: clamp(Number(o["reps"] ?? 10), 0, 300),
      rest_s: clamp(Number(o["rest_s"] ?? 60), 0, 600),
      note: typeof o["note"] === "string" ? (o["note"] as string).slice(0, 160) : "",
    });
  });
  return out.length ? out : null;
}

function clamp(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}
