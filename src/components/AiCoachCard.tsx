import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getCoachAdvice } from "@/lib/coach.functions";
import { createCoachRequestGuard, isAnonymousCoachIdentity } from "@/lib/coach-safety";
import { getCoachFocus } from "@/lib/workout-plans";

type Advice = {
  advice: string;
  plan: { sets: number; reps: number; rest_s: number };
  source: "ai" | "fallback";
  cached_at: string;
};

export function AiCoachCard() {
  const call = useServerFn(getCoachAdvice);
  const mounted = useRef(false);
  const lifecycleGeneration = useRef(0);
  const [hasHistory, setHasHistory] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [data, setData] = useState<Advice | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focus, setFocus] = useState(
    "Starte heute mit einem sauberen Set und baue dir sofort Vertrauen auf.",
  );

  const load = async (force = false) => {
    const isActive = createCoachRequestGuard(
      () => mounted.current,
      () => lifecycleGeneration.current,
    );
    if (!isActive() || isGuest || (!hasHistory && force)) return;
    if (force) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await call({ data: { force } });
      if (!isActive()) return;
      setData(res);
    } catch (e) {
      if (!isActive()) return;
      setError(e instanceof Error ? e.message : "Konnte Coach nicht laden");
    } finally {
      if (isActive()) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    mounted.current = true;
    const isActive = createCoachRequestGuard(
      () => mounted.current,
      () => lifecycleGeneration.current,
    );
    void (async () => {
      try {
        const { data: u, error: authError } = await supabase.auth.getUser();
        if (!isActive()) return;
        if (authError || !u.user) {
          setError("Coach-Sitzung konnte nicht sicher geprüft werden.");
          setLoading(false);
          return;
        }
        if (isAnonymousCoachIdentity(u.user)) {
          setIsGuest(true);
          setLoading(false);
          return;
        }
        const { data: history, error: historyError } = await supabase
          .from("workouts")
          .select("id")
          .eq("user_id", u.user.id)
          .limit(1);
        if (!isActive()) return;
        if (historyError) {
          setError("Trainingsverlauf konnte nicht sicher geladen werden.");
          setLoading(false);
          return;
        }
        const hasWorkouts = !!history?.length;
        setHasHistory(hasWorkouts);
        if (!hasWorkouts) {
          setLoading(false);
          return;
        }
        const today = new Date().toISOString().slice(0, 10);
        const [{ data: profile, error: profileError }, { data: stats, error: statsError }] =
          await Promise.all([
            supabase
              .from("profiles")
              .select("best_count, current_streak")
              .eq("id", u.user.id)
              .maybeSingle(),
            supabase
              .from("daily_stats")
              .select("total_reps")
              .eq("user_id", u.user.id)
              .eq("day", today)
              .maybeSingle(),
          ]);
        if (!isActive()) return;
        if (profileError || statsError) {
          setError("Coach-Daten konnten nicht sicher geladen werden.");
          setLoading(false);
          return;
        }
        const best = (profile as { best_count?: number } | null)?.best_count ?? 0;
        const streak = (profile as { current_streak?: number } | null)?.current_streak ?? 0;
        const todayReps = (stats as { total_reps?: number } | null)?.total_reps ?? 0;
        const weekReps = todayReps;
        setFocus(getCoachFocus(best, weekReps, streak));
        await load(false);
      } catch {
        if (!isActive()) return;
        setError("Coach-Daten konnten nicht sicher geladen werden.");
        setLoading(false);
      }
    })();
    return () => {
      mounted.current = false;
      lifecycleGeneration.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canRefresh = data ? Date.now() - +new Date(data.cached_at) > 60 * 60 * 1000 : true;

  return (
    <section className="mt-6 overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card/70 to-card/60 p-5 backdrop-blur">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-sm">
            🧠
          </span>
          <h2 className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Smart Coach
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/ai"
            className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary transition hover:bg-primary/20"
          >
            💬 Chat
          </Link>
          <button
            onClick={() => canRefresh && !refreshing && load(true)}
            disabled={isGuest || !hasHistory || !canRefresh || refreshing || loading}
            className="rounded-full border border-border bg-secondary px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground transition hover:text-foreground disabled:opacity-50"
            title={canRefresh ? "Neu generieren" : "Frühestens in 1 h wieder"}
          >
            {refreshing ? "…" : "↻"}
          </button>
        </div>
      </div>

      <div className="mt-4 min-h-[80px] text-sm leading-relaxed text-foreground">
        {!loading && isGuest && (
          <div className="space-y-2">
            <p>Der Smart Coach ist für Gastkonten deaktiviert.</p>
            <p className="text-xs text-muted-foreground">
              Auch wenn auf diesem Gerät Trainings vorhanden sind, wird dafür keine KI-Anfrage
              gestartet. Melde dich mit einem Konto an, um persönliche Coach-Empfehlungen zu nutzen.
            </p>
          </div>
        )}
        {!loading && !error && !isGuest && !hasHistory && (
          <div className="space-y-3">
            <p>Noch keine Trainingsgrundlage für eine persönliche Empfehlung.</p>
            <p className="text-xs text-muted-foreground">
              Unverbindlicher Startvorschlag: Wenn du dich fit fühlst, probiere einen lockeren Satz
              mit bis zu 3 Liegestützen. Passe die Anzahl an dich an und stoppe bei Schmerzen. Das
              ist keine persönliche Auswertung; es wird keine KI-Anfrage gestartet.
            </p>
            <Link
              to="/workout/$exerciseId"
              params={{ exerciseId: "pushup" }}
              search={{ mode: "manual" }}
              className="flex min-h-11 items-center justify-center rounded-xl border border-primary/40 px-4 py-3 text-sm font-semibold text-primary"
            >
              Manuelle Erfassung öffnen
            </Link>
          </div>
        )}
        {loading && !data && (
          <div className="flex h-full items-center justify-center py-4 text-xs text-muted-foreground">
            Coach denkt nach…
          </div>
        )}
        {error && !data && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
            {error}
          </div>
        )}
        {data && (
          <div className="space-y-3">
            <p>{data.advice}</p>
            <div className="rounded-2xl border border-primary/20 bg-background/50 p-3 text-xs text-muted-foreground">
              <div className="font-semibold uppercase tracking-[0.2em] text-primary">
                Coach-Fokus
              </div>
              <div className="mt-1 text-sm text-foreground">{focus}</div>
            </div>
          </div>
        )}
      </div>

      {data && (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <PlanStat label="Sätze" value={data.plan.sets} />
            <PlanStat label="Wdh." value={data.plan.reps} />
            <PlanStat label="Pause" value={`${data.plan.rest_s}s`} />
          </div>
          <Link
            to="/workout/$exerciseId"
            params={{ exerciseId: "pushup" }}
            search={{ mode: "nose" }}
            className="mt-4 flex w-full items-center justify-center rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition active:scale-[0.98]"
          >
            Los geht’s →
          </Link>
          <div className="mt-2 text-center text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
            {data.source === "ai" ? "KI-Empfehlung" : "Basis-Empfehlung"}
          </div>
        </>
      )}
    </section>
  );
}

function PlanStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border bg-background/40 py-3">
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
