/**
 * Dedicated Calisthenics Workout Screen
 * - Sets × Reps or Hold-Time tracking
 * - Rest timer between sets (90 s default, adjustable)
 * - RPE (Rate of Perceived Exertion) after each set
 * - Saves each set as a separate workout entry; best in set shown in progression
 */
import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { allSkills } from "@/lib/calisthenics";
import type { CaliSkill } from "@/lib/calisthenics";
import { feedbackRep, feedbackSuccess } from "@/lib/feedback";

export const Route = createFileRoute("/_authenticated/cali-workout/$skillId")({
  head: ({ params }) => ({
    meta: [{ title: `${params.skillId} — Cali Workout` }],
  }),
  component: CaliWorkoutScreen,
});

type SetRecord = {
  count: number;   // reps or seconds
  rpe: number;     // 1–10
};

const DEFAULT_REST_S = 90;
const RPE_LABELS: Record<number, string> = {
  1: "Sehr leicht",  2: "Leicht",  3: "Moderat",  4: "Etwas schwer",
  5: "Schwer",       6: "Schwer+", 7: "Sehr schwer", 8: "Extrem",
  9: "Maximal",      10: "Total failure",
};

function formatSec(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}:${r.toString().padStart(2, "0")}` : `${r}s`;
}

function CaliWorkoutScreen() {
  const { skillId } = useParams({ from: "/_authenticated/cali-workout/$skillId" });
  const navigate = useNavigate();

  const skill: CaliSkill | undefined = allSkills().find((s) => s.id === skillId);

  const [userId, setUserId] = useState<string | null>(null);
  const [prevBest, setPrevBest] = useState(0);

  // Workout state
  const [phase, setPhase] = useState<"idle" | "active" | "resting" | "rpe" | "done">("idle");
  const [sets, setSets] = useState<SetRecord[]>([]);
  const [currentCount, setCurrentCount] = useState(0);
  const [rpe, setRpe] = useState(5);
  const [restSecs, setRestSecs] = useState(DEFAULT_REST_S);
  const [restRemaining, setRestRemaining] = useState(DEFAULT_REST_S);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  // Timer for holds (seconds-based skills)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isHold = skill?.unit === "seconds";

  // Load user + personal best
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setUserId(u.user.id);
      const { data: p } = await supabase
        .from("profiles")
        .select("personal_bests")
        .eq("id", u.user.id)
        .maybeSingle();
      if (p) {
        const pb = (p as { personal_bests: Record<string, number> | null }).personal_bests ?? {};
        setPrevBest(pb[skillId] ?? 0);
      }
    })();
  }, [skillId]);

  // Active hold timer
  useEffect(() => {
    if (phase === "active" && isHold) {
      intervalRef.current = setInterval(() => {
        setCurrentCount((c) => {
          feedbackRep(c + 1);
          return c + 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [phase, isHold]);

  // Rest countdown
  useEffect(() => {
    if (phase !== "resting") return;
    const id = setInterval(() => {
      setRestRemaining((r) => {
        if (r <= 1) {
          clearInterval(id);
          setPhase("idle");
          return restSecs;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [phase, restSecs]);

  const startSet = useCallback(() => {
    setCurrentCount(0);
    setPhase("active");
  }, []);

  const stopSet = useCallback(() => {
    if (phase !== "active") return;
    setPhase("rpe");
  }, [phase]);

  const addRep = useCallback(() => {
    if (phase !== "active" || isHold) return;
    feedbackRep(currentCount + 1);
    setCurrentCount((c) => c + 1);
  }, [phase, isHold, currentCount]);

  const confirmRpe = useCallback(() => {
    const record: SetRecord = { count: currentCount, rpe };
    setSets((prev) => [...prev, record]);
    setCurrentCount(0);
    setRpe(5);
    setPhase("resting");
    setRestRemaining(restSecs);
  }, [currentCount, rpe, restSecs]);

  const skipRest = () => {
    setRestRemaining(0);
    setPhase("idle");
  };

  const finishWorkout = async () => {
    if (!userId || sets.length === 0 || !skill) return;
    setSaving(true);

    // Save each set as a separate workout row
    const bestSet = Math.max(...sets.map((s) => s.count));
    const inserts = sets.map((s) => ({
      user_id: userId,
      exercise_id: skillId,
      count: s.count,
      duration_ms: isHold ? s.count * 1000 : 0,
    }));

    const { error } = await supabase.from("workouts").insert(inserts);
    if (!error) {
      feedbackSuccess();
      // Client-side PB update
      if (bestSet > prevBest) {
        await (supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<unknown>)("update_personal_best", {
          p_user_id: userId,
          p_exercise_id: skillId,
          p_count: bestSet,
        });
        setPrevBest(bestSet);
        setSavedMsg(`🏆 Neuer Bestwert: ${bestSet}${isHold ? " Sek." : " Reps"}`);
      } else {
        setSavedMsg(`${sets.length} Sets gespeichert ✓`);
      }
      setPhase("done");
    } else {
      setSavedMsg("Fehler beim Speichern — bitte erneut versuchen.");
    }
    setSaving(false);
  };

  if (!skill) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center flex-col gap-4 text-sm text-muted-foreground p-6 text-center">
        <span className="text-4xl">🤷</span>
        <p>Skill nicht gefunden.</p>
        <button onClick={() => navigate({ to: "/calisthenics" })} className="text-primary underline">
          Zurück zu Calisthenics
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pt-6 pb-10">
      {/* Header */}
      <header className="flex items-center justify-between">
        <Link
          to="/calisthenics"
          className="text-xs uppercase tracking-[0.25em] text-muted-foreground hover:text-foreground transition"
        >
          ← Cali
        </Link>
        <span className="flex items-center gap-2 text-sm font-semibold">
          <span className="text-2xl">{skill.icon}</span>
          {skill.name}
        </span>
        <span className="w-12" />
      </header>

      {/* Tip card */}
      <div className="mt-4 rounded-2xl border border-border bg-card/50 px-4 py-3 text-xs text-muted-foreground leading-relaxed backdrop-blur">
        💡 <span className="font-medium text-foreground">Tipp:</span> {skill.tip}
      </div>

      {/* Stats row */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <StatCell label="Sets" value={sets.length.toString()} />
        <StatCell
          label="Bestwert"
          value={prevBest > 0 ? prevBest.toString() : "—"}
          unit={isHold ? "Sek." : ""}
        />
        <StatCell
          label="Bestes Set"
          value={sets.length > 0 ? Math.max(...sets.map((s) => s.count)).toString() : "—"}
          unit={isHold ? "Sek." : ""}
        />
      </div>

      {/* Main area */}
      <div className="mt-4 flex flex-1 flex-col">
        {/* DONE */}
        {phase === "done" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 rounded-[2rem] border border-border bg-card/60 p-8 text-center backdrop-blur">
            <span className="text-6xl">🎯</span>
            <div>
              <p className="text-lg font-bold">{savedMsg}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {sets.length} Sets · Ø {isHold ? "" : ""}{Math.round(sets.reduce((a, s) => a + s.count, 0) / sets.length)}{isHold ? " Sek." : " Reps"}
              </p>
            </div>
            <button
              onClick={() => navigate({ to: "/calisthenics" })}
              className="rounded-xl bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground"
            >
              Zurück zum Skill Tree
            </button>
          </div>
        )}

        {/* RPE input */}
        {phase === "rpe" && (
          <div className="flex flex-1 flex-col rounded-[2rem] border border-border bg-card/60 p-6 backdrop-blur">
            <div className="text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Set {sets.length + 1} abgeschlossen</p>
              <p className="mt-2 text-5xl font-bold tabular-nums">
                {currentCount}{isHold ? <span className="text-2xl font-normal ml-1 text-muted-foreground">Sek.</span> : ""}
              </p>
            </div>
            <div className="mt-6 flex-1 flex flex-col gap-3">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground text-center">
                RPE — Wie schwer war der Set?
              </p>
              <div className="flex gap-1 flex-wrap justify-center">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => (
                  <button
                    key={v}
                    onClick={() => setRpe(v)}
                    className={`h-9 w-9 rounded-xl text-sm font-bold transition ${
                      rpe === v
                        ? "bg-primary text-primary-foreground scale-110"
                        : "bg-secondary text-muted-foreground hover:bg-secondary/70"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <p className="text-center text-sm text-muted-foreground">
                {RPE_LABELS[rpe]}
              </p>
            </div>
            <button
              onClick={confirmRpe}
              className="mt-4 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground"
            >
              Bestätigen → Pause
            </button>
          </div>
        )}

        {/* Rest timer */}
        {phase === "resting" && (
          <div className="flex flex-1 flex-col items-center justify-center rounded-[2rem] border border-border bg-card/60 p-8 text-center backdrop-blur gap-4">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Pause</p>
            <div
              className="relative flex h-32 w-32 items-center justify-center rounded-full border-4 border-primary/30"
              style={{
                background: `conic-gradient(oklch(var(--color-primary)/0.8) ${(restRemaining / restSecs) * 360}deg, transparent 0deg)`,
              }}
            >
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-background">
                <span className="text-3xl font-bold tabular-nums">{formatSec(restRemaining)}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setRestSecs((s) => Math.max(30, s - 15))}
                className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium"
              >
                −15s
              </button>
              <span className="text-xs text-muted-foreground">Pausenlänge: {formatSec(restSecs)}</span>
              <button
                onClick={() => setRestSecs((s) => Math.min(300, s + 15))}
                className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium"
              >
                +15s
              </button>
            </div>
            <button onClick={skipRest} className="text-xs text-primary underline">
              Pause überspringen
            </button>
          </div>
        )}

        {/* Idle / Active */}
        {(phase === "idle" || phase === "active") && (
          <div
            className="flex flex-1 flex-col items-center justify-center rounded-[2rem] border border-border bg-card/60 backdrop-blur select-none"
            onPointerDown={!isHold && phase === "active" ? addRep : undefined}
          >
            {/* Count display */}
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-2">
              {phase === "idle" ? `Set ${sets.length + 1}` : isHold ? "Halten…" : "Tippe auf die Fläche"}
            </p>
            <span
              className="font-display text-[7rem] leading-none font-bold tabular-nums text-foreground"
              style={{ textShadow: "0 0 40px oklch(0.82 0.19 95 / 0.3)" }}
            >
              {currentCount}
            </span>
            {isHold && phase === "active" && (
              <p className="mt-2 text-sm text-muted-foreground animate-pulse">Sekunden</p>
            )}
            {!isHold && phase === "active" && (
              <p className="mt-2 text-xs text-muted-foreground">Tippe · jede Rep zählt</p>
            )}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="mt-4 space-y-2">
        {phase === "idle" && (
          <>
            <button
              onClick={startSet}
              className="w-full rounded-xl bg-primary py-4 text-sm font-semibold text-primary-foreground transition active:scale-[0.98]"
            >
              {sets.length === 0 ? "Ersten Set starten" : "Nächsten Set starten"}
            </button>
            {sets.length > 0 && (
              <button
                onClick={finishWorkout}
                disabled={saving}
                className="w-full rounded-xl border border-border bg-secondary py-3 text-sm font-medium text-secondary-foreground transition active:scale-[0.98] disabled:opacity-50"
              >
                {saving ? "Speichere…" : `Workout beenden (${sets.length} Sets)`}
              </button>
            )}
          </>
        )}
        {phase === "active" && (
          <button
            onClick={stopSet}
            className="w-full rounded-xl border border-destructive/60 bg-destructive/10 py-4 text-sm font-semibold text-destructive transition active:scale-[0.98]"
          >
            {isHold ? "Stop" : "Set beenden"}
          </button>
        )}
      </div>

      {/* Completed sets summary */}
      {sets.length > 0 && phase !== "done" && (
        <div className="mt-4 space-y-1.5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Abgeschlossene Sets</p>
          {sets.map((s, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-xl bg-secondary/40 px-3 py-2 text-sm"
            >
              <span className="text-muted-foreground">Set {i + 1}</span>
              <div className="flex items-center gap-3">
                <span className="font-semibold tabular-nums">
                  {s.count}{isHold ? " Sek." : " Reps"}
                </span>
                <span className="text-[10px] text-muted-foreground">RPE {s.rpe}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

function StatCell({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card/50 px-3 py-3 backdrop-blur text-center">
      <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-baseline justify-center gap-1">
        <span className="text-xl font-semibold tabular-nums text-foreground">{value}</span>
        {unit && <span className="text-[10px] text-muted-foreground">{unit}</span>}
      </div>
    </div>
  );
}
