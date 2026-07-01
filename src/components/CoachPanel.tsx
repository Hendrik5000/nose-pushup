import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { levelProgress, XP_PER_REP } from "@/lib/level";

type Workout = {
  id: string;
  count: number;
  duration_ms: number;
  created_at: string;
  exercise_id?: string | null;
};

type ProfileLike = {
  xp: number;
  current_streak: number;
  longest_streak: number;
  last_workout_date: string | null;
  best_count: number;
  streak_freezes: number;
};

type Props = { profile: ProfileLike; workouts: Workout[] };

const EX_LABEL: Record<string, string> = {
  pushup: "Push-Ups",
  situp: "Sit-Ups",
  squat: "Squats",
  plank: "Plank",
  burpee: "Burpees",
};

function daysBetween(a: string, b: string) {
  return Math.round((+new Date(a) - +new Date(b)) / 86400000);
}

export function CoachPanel({ profile, workouts }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  const lp = levelProgress(profile.xp ?? 0);
  const streak = profile.current_streak ?? 0;
  const streakActive =
    profile.last_workout_date === today || profile.last_workout_date === yesterday;
  const workedOutToday = profile.last_workout_date === today;

  // Suggested target for today: push best_count by ~10%, min +2, capped for sanity.
  const targetToday = Math.max(10, Math.round((profile.best_count || 10) * 1.1) + 2);

  // Detect dominant recent exercise.
  const recent = workouts.slice(0, 8);
  const counts = recent.reduce<Record<string, number>>((acc, w) => {
    const k = w.exercise_id || "pushup";
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  const dominant =
    Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "pushup";
  const suggestNext = dominant === "pushup" ? "situp" : "pushup";

  // 7-day rolling reps.
  const weekReps = useMemo(() => {
    const cutoff = Date.now() - 7 * 86400000;
    return workouts
      .filter((w) => +new Date(w.created_at) >= cutoff)
      .reduce((s, w) => s + w.count, 0);
  }, [workouts]);

  const status = useMemo(() => {
    if (!profile.last_workout_date) {
      return {
        tone: "start" as const,
        title: "Los geht’s!",
        text: "Starte dein erstes Training und beginne deine Streak.",
      };
    }
    if (workedOutToday) {
      return {
        tone: "good" as const,
        title: "Heute erledigt 🔥",
        text: `Streak +1. Noch ${lp.xpToNext} XP bis Level ${lp.level + 1}.`,
      };
    }
    if (streakActive) {
      return {
        tone: "warn" as const,
        title: "Streak in Gefahr",
        text: `Trainiere heute, sonst reißt deine Serie von ${streak}.`,
      };
    }
    const gap = daysBetween(today, profile.last_workout_date);
    return {
      tone: "reset" as const,
      title: "Zurück auf die Matte",
      text: `${gap} Tage Pause – ein kurzes Set reicht, um neu zu starten.`,
    };
  }, [profile.last_workout_date, workedOutToday, streakActive, streak, lp, today]);

  const toneClass =
    status.tone === "good"
      ? "border-primary/40 bg-primary/10 text-primary"
      : status.tone === "warn"
        ? "border-destructive/40 bg-destructive/10 text-destructive"
        : status.tone === "reset"
          ? "border-border bg-secondary text-muted-foreground"
          : "border-primary/30 bg-primary/5 text-primary";

  const reps = [
    { label: `Set 1 · ${Math.max(5, Math.round(targetToday * 0.35))}` },
    { label: `Set 2 · ${Math.max(5, Math.round(targetToday * 0.35))}` },
    { label: `Set 3 · ${Math.max(5, Math.round(targetToday * 0.3))}` },
  ];

  return (
    <section className="mt-6 rounded-3xl border border-border bg-card/60 p-5 backdrop-blur">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Coach
        </h2>
        <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          Lv {lp.level} · {lp.title}
        </span>
      </div>

      <div className={`mt-3 rounded-2xl border px-4 py-3 ${toneClass}`}>
        <div className="text-sm font-semibold">{status.title}</div>
        <div className="mt-0.5 text-xs opacity-90">{status.text}</div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <MiniStat label="Streak" value={`${streak}${streakActive ? "🔥" : ""}`} />
        <MiniStat label="7 Tage" value={String(weekReps)} />
        <MiniStat label="Freezes" value={String(profile.streak_freezes ?? 0)} />
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Nächstes Training
          </span>
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Ziel {targetToday} Reps · +{targetToday * XP_PER_REP} XP
          </span>
        </div>
        <div className="rounded-2xl border border-border bg-background/50 p-4">
          <div className="text-base font-semibold">
            {EX_LABEL[suggestNext] ?? "Push-Ups"}{" "}
            <span className="text-xs font-normal text-muted-foreground">
              · Wechsel zu {EX_LABEL[suggestNext]} für Balance
            </span>
          </div>
          <ul className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
            {reps.map((s, i) => (
              <li
                key={i}
                className="rounded-xl border border-border bg-card/60 py-2 font-semibold tabular-nums"
              >
                {s.label}
              </li>
            ))}
          </ul>
          <Link
            to="/workout/$exerciseId"
            params={{ exerciseId: suggestNext }}
            className="mt-4 flex w-full items-center justify-center rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition active:scale-[0.98]"
          >
            Jetzt starten →
          </Link>
        </div>
      </div>

      <ul className="mt-4 space-y-1 text-xs text-muted-foreground">
        <li>• Kurze Pausen (60–90s) zwischen den Sets.</li>
        <li>• Saubere Form zählt mehr als Tempo.</li>
        {!workedOutToday && streakActive && (
          <li className="text-destructive">• Heute noch trainieren, um die Streak zu retten.</li>
        )}
      </ul>
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card/40 py-2">
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}
