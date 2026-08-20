import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getWeekPlan } from "@/lib/coach-plan.functions";
import type { WeekPlan } from "@/lib/coach-plan.server";

const FOCUS_LABEL: Record<string, string> = {
  push: "Push",
  core: "Core",
  legs: "Beine",
  mobility: "Mobilität",
  full: "Ganzkörper",
  rest: "Ruhetag",
};

const DAY_LABEL = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function WeekPlanCard({ compact = false }: { compact?: boolean }) {
  const load = useServerFn(getWeekPlan);
  const [plan, setPlan] = useState<WeekPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlan = async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await load({ data: { force } });
      setPlan(res);
    } catch {
      setError("Plan konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchPlan(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const today = todayIso();
  const todayEntry = plan?.days.find((d) => d.day === today) ?? plan?.days[0];

  return (
    <section className="mt-6 rounded-3xl border border-border bg-card/60 p-5 backdrop-blur">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Wochenplan
        </h2>
        <button
          type="button"
          onClick={() => void fetchPlan(true)}
          disabled={loading}
          className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground transition hover:text-foreground disabled:opacity-50"
        >
          {loading ? "…" : "Neu"}
        </button>
      </div>

      {error && <p className="mt-3 text-xs text-destructive">{error}</p>}

      {loading && !plan && (
        <div className="mt-4 space-y-2">
          <div className="h-16 animate-pulse rounded-2xl bg-secondary" />
          <div className="h-10 animate-pulse rounded-2xl bg-secondary" />
        </div>
      )}

      {plan && (
        <>
          <p className="mt-3 text-sm text-muted-foreground">{plan.summary}</p>

          {todayEntry && (
            <div className="mt-4 rounded-2xl border border-primary/30 bg-primary/5 p-4">
              <div className="text-[10px] uppercase tracking-[0.2em] text-primary">Heute</div>
              <div className="mt-1 text-base font-semibold">
                {FOCUS_LABEL[todayEntry.focus] ?? todayEntry.focus}
                {todayEntry.sets > 0 && (
                  <span className="text-xs font-normal text-muted-foreground">
                    {" "}
                    · {todayEntry.sets} × {todayEntry.reps} · {todayEntry.rest_s}s Pause
                  </span>
                )}
              </div>
              {todayEntry.note && (
                <p className="mt-1 text-xs text-muted-foreground">{todayEntry.note}</p>
              )}
              {todayEntry.exercise_id && (
                <Link
                  to="/workout/$exerciseId"
                  params={{ exerciseId: todayEntry.exercise_id }}
                  className="mt-3 flex w-full items-center justify-center rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition active:scale-[0.98]"
                >
                  Session starten →
                </Link>
              )}
            </div>
          )}

          {!compact && (
            <ul className="mt-4 grid grid-cols-7 gap-1 text-center">
              {plan.days.map((d, i) => {
                const isToday = d.day === today;
                return (
                  <li
                    key={d.day}
                    className={`rounded-xl border px-1 py-2 text-[10px] ${
                      isToday
                        ? "border-primary/50 bg-primary/10 text-primary"
                        : "border-border bg-card/40 text-muted-foreground"
                    }`}
                  >
                    <div className="font-semibold">{DAY_LABEL[i]}</div>
                    <div className="mt-0.5 truncate">{FOCUS_LABEL[d.focus] ?? d.focus}</div>
                    {d.sets > 0 && (
                      <div className="mt-0.5 tabular-nums">
                        {d.sets}×{d.reps}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
