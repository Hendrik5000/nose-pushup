import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  generateMicroChallenge,
  ensureMicroProgress,
  markXpClaimed,
  type MicroChallenge,
  type MicroInput,
  type MicroProgress,
} from "@/lib/micro-challenge";
import type { ReadinessLevel } from "@/lib/readiness";

type Props = {
  userId: string | null;
  pushupBest: number;
  dailyGoal: number;
  todayReps: number;
  streak: number;
  readinessLevel: ReadinessLevel;
  /** Optional plank best in seconds. */
  plankBest?: number;
};

export function MicroChallengeCard({
  userId,
  pushupBest,
  dailyGoal,
  todayReps,
  streak,
  readinessLevel,
  plankBest,
}: Props) {
  const [todayWorkouts, setTodayWorkouts] = useState(0);
  const [progress, setProgress] = useState<MicroProgress | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [justClaimed, setJustClaimed] = useState(false);

  const challenge: MicroChallenge = useMemo(
    () =>
      generateMicroChallenge({
        pushupBest,
        dailyGoal,
        todayReps,
        todayWorkouts,
        streak,
        readinessLevel,
        plankBest,
      }),
    [pushupBest, dailyGoal, todayReps, todayWorkouts, streak, readinessLevel, plankBest],
  );

  // Load today's workout count (any exercise)
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { count } = await supabase
        .from("workouts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", `${today}T00:00:00.000Z`)
        .lte("created_at", `${today}T23:59:59.999Z`);
      if (!cancelled) setTodayWorkouts(count ?? 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, todayReps]); // re-check when reps change (proxy for new workout)

  // Sync progress whenever inputs change
  useEffect(() => {
    const input: Pick<MicroInput, "todayReps" | "todayWorkouts"> = {
      todayReps,
      todayWorkouts,
    };
    const p = ensureMicroProgress(challenge, input);
    setProgress(p);
  }, [challenge, todayReps, todayWorkouts]);

  const pct = progress
    ? Math.min(100, Math.round((progress.progress / challenge.target) * 100))
    : 0;
  const done = progress?.completed ?? false;
  const xpClaimed = progress?.xpClaimed ?? false;

  const claimXp = async () => {
    if (!userId || !done || xpClaimed || claiming) return;
    setClaiming(true);
    try {
      // Optimistic local claim + best-effort profile XP bump
      const { data: prof } = await supabase
        .from("profiles")
        .select("xp")
        .eq("id", userId)
        .maybeSingle();
      const currentXp = (prof as { xp?: number } | null)?.xp ?? 0;
      await supabase
        .from("profiles")
        .update({ xp: currentXp + challenge.xpReward })
        .eq("id", userId);
      markXpClaimed();
      setProgress((prev) => (prev ? { ...prev, xpClaimed: true } : prev));
      setJustClaimed(true);
    } catch (e) {
      console.error("[micro-challenge] claim failed", e);
    } finally {
      setClaiming(false);
    }
  };

  // Auto-claim once when completed (one-shot)
  useEffect(() => {
    if (done && !xpClaimed && userId) {
      void claimXp();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, xpClaimed, userId]);

  const difficultyLabel =
    challenge.difficulty === "easy"
      ? "Leicht"
      : challenge.difficulty === "medium"
        ? "Mittel"
        : "Schwer";

  const unitLabel =
    challenge.unit === "reps" ? "Reps" : challenge.unit === "seconds" ? "Sek." : "Workout";

  return (
    <section
      className={`mt-4 overflow-hidden rounded-3xl border p-4 backdrop-blur transition ${
        done ? "border-primary/40 bg-primary/10" : "border-border bg-card/60"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="text-3xl leading-none">{challenge.icon}</span>
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
              Micro-Challenge · Heute
            </div>
            <h2 className="mt-0.5 text-base font-semibold text-foreground">{challenge.title}</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {challenge.description}
            </p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            {difficultyLabel}
          </div>
          <div className="mt-1 text-xs font-semibold text-primary">+{challenge.xpReward} XP</div>
        </div>
      </div>

      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            done ? "bg-primary" : "bg-primary/70"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        <span className="tabular-nums">
          {progress?.progress ?? 0} / {challenge.target} {unitLabel}
        </span>
        <span>{done ? "✓ Geschafft" : `${pct}%`}</span>
      </div>

      {done ? (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-2xl border border-primary/25 bg-primary/5 px-3 py-2.5">
          <div className="text-sm font-medium text-foreground">
            {justClaimed || xpClaimed
              ? `Nice! +${challenge.xpReward} XP eingesammelt`
              : "Challenge abgeschlossen"}
          </div>
          <span className="text-xl">🎉</span>
        </div>
      ) : (
        <div className="mt-3">
          {challenge.exerciseId ? (
            <Link
              to="/workout/$exerciseId"
              params={{ exerciseId: challenge.exerciseId }}
              search={challenge.exerciseId === "pushup" ? { mode: "nose" as const } : undefined}
              className="flex w-full items-center justify-center rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition active:scale-[0.98]"
            >
              Challenge starten →
            </Link>
          ) : (
            <Link
              to="/workout/$exerciseId"
              params={{ exerciseId: "pushup" }}
              search={{ mode: "nose" }}
              className="flex w-full items-center justify-center rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition active:scale-[0.98]"
            >
              Irgendein Workout starten →
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
