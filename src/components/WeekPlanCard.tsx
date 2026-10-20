import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { createCoachRequestGuard, isAnonymousCoachIdentity } from "@/lib/coach-safety";
import { getWeekPlan } from "@/lib/coach-plan.functions";
import type { WeekPlan } from "@/lib/coach-plan.server";

const FOCUS_LABEL: Record<string, string> = {
  push: "Drückübungen",
  core: "Rumpf",
  legs: "Beine",
  mobility: "Mobilität",
  full: "Ganzkörper",
  rest: "Ruhetag",
};

const DAY_LABEL = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function WeekPlanCard({ compact = false }: { compact?: boolean }) {
  const load = useServerFn(getWeekPlan);
  const mounted = useRef(false);
  const lifecycleGeneration = useRef(0);
  const [plan, setPlan] = useState<WeekPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGuest, setIsGuest] = useState(false);

  const fetchPlan = async () => {
    const isActive = createCoachRequestGuard(
      () => mounted.current,
      () => lifecycleGeneration.current,
    );
    if (!isActive() || isGuest) return;
    setLoading(true);
    setError(null);
    try {
      // The server intentionally serves the saved plan; this is a reload, not regeneration.
      const res = await load({ data: { force: false } });
      if (!isActive()) return;
      setPlan(res);
    } catch {
      if (!isActive()) return;
      setError("Plan konnte nicht geladen werden.");
    } finally {
      if (isActive()) setLoading(false);
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
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (!isActive()) return;
        if (authError || !auth.user) {
          setError("Bitte melde dich an, um den Wochenplan zu laden.");
          setLoading(false);
          return;
        }
        if (isAnonymousCoachIdentity(auth.user)) {
          setIsGuest(true);
          setLoading(false);
          return;
        }
        await fetchPlan();
      } catch {
        if (!isActive()) return;
        setError("Wochenplan konnte nicht sicher geladen werden.");
        setLoading(false);
      }
    })();
    return () => {
      mounted.current = false;
      lifecycleGeneration.current += 1;
    };
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
          onClick={() => void fetchPlan()}
          disabled={loading || isGuest}
          className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground transition hover:text-foreground disabled:opacity-50"
          title="Gespeicherten Wochenplan erneut laden"
        >
          {loading ? "…" : plan ? "Aktualisieren" : "Gespeicherten Plan laden"}
        </button>
      </div>

      {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
      {isGuest && (
        <p className="mt-3 text-xs text-muted-foreground">
          Wochenpläne sind für Gastkonten deaktiviert; es wird keine KI-Anfrage gestartet.
        </p>
      )}

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
                  search={{
                    sets: todayEntry.sets,
                    reps: todayEntry.reps,
                    rest_s: todayEntry.rest_s,
                    title: FOCUS_LABEL[todayEntry.focus] ?? todayEntry.focus,
                  }}
                  className="mt-3 flex w-full items-center justify-center rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition active:scale-[0.98]"
                >
                  Training starten →
                </Link>
              )}
            </div>
          )}

          {!compact && (
            <ul className="mt-4 grid grid-cols-2 gap-2 text-center sm:grid-cols-4 lg:grid-cols-7">
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
                    {isToday && <div className="mt-0.5 font-semibold">Heute</div>}
                    <div className="mt-0.5 break-words hyphens-auto">
                      {FOCUS_LABEL[d.focus] ?? d.focus}
                    </div>
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
