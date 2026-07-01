import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getCoachAdvice } from "@/lib/coach.functions";

type Advice = {
  advice: string;
  plan: { sets: number; reps: number; rest_s: number };
  source: "ai" | "fallback";
  cached_at: string;
};

export function AiCoachCard() {
  const call = useServerFn(getCoachAdvice);
  const [data, setData] = useState<Advice | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await call({ data: { force } });
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Konnte Coach nicht laden");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canRefresh = data
    ? Date.now() - +new Date(data.cached_at) > 60 * 60 * 1000
    : true;

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
        <button
          onClick={() => canRefresh && !refreshing && load(true)}
          disabled={!canRefresh || refreshing || loading}
          className="rounded-full border border-border bg-secondary px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground transition hover:text-foreground disabled:opacity-50"
          title={canRefresh ? "Neu generieren" : "Frühestens in 1 h wieder"}
        >
          {refreshing ? "…" : "↻ Neu"}
        </button>
      </div>

      <div className="mt-4 min-h-[80px] text-sm leading-relaxed text-foreground">
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
        {data && <p>{data.advice}</p>}
      </div>

      {data && (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <PlanStat label="Sets" value={data.plan.sets} />
            <PlanStat label="Reps" value={data.plan.reps} />
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
            {data.source === "ai" ? "AI-Empfehlung" : "Basis-Empfehlung"}
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
