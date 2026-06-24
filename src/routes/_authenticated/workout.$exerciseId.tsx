import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useExerciseEngine, ensureMotionPermission } from "@/hooks/useExerciseEngine";
import type { ExerciseMeta } from "@/lib/exercises";
import { getConfig } from "@/lib/exercises";

export const Route = createFileRoute("/_authenticated/workout/$exerciseId")({
  head: ({ params }) => ({
    meta: [{ title: `${params.exerciseId} — Nose Push` }],
  }),
  component: WorkoutScreen,
});

function formatTime(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m.toString().padStart(2, "0")}:${r.toString().padStart(2, "0")}`;
}

function WorkoutScreen() {
  const { exerciseId } = useParams({ from: "/_authenticated/workout/$exerciseId" });
  const navigate = useNavigate();

  const [exercise, setExercise] = useState<ExerciseMeta | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [best, setBest] = useState(0);

  const [active, setActive] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [saving, setSaving] = useState(false);
  const [savedHint, setSavedHint] = useState<string | null>(null);
  const [motionError, setMotionError] = useState<string | null>(null);

  const audioCtx = useRef<AudioContext | null>(null);

  const detection = exercise?.detection_type ?? "touch";
  const { count, pop, bump, reset: resetEngine } = useExerciseEngine({
    exerciseId,
    detection,
    active,
    onTick: () => {
      try {
        if (!audioCtx.current) {
          const Ctx = window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          audioCtx.current = new Ctx();
        }
        const ctx = audioCtx.current!;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.value = 660;
        o.type = "sine";
        g.gain.setValueAtTime(0.0001, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
        o.connect(g).connect(ctx.destination);
        o.start();
        o.stop(ctx.currentTime + 0.13);
      } catch {
        /* ignore */
      }
    },
  });

  // Load exercise + user best
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: u }, { data: ex }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from("exercises").select("*").eq("id", exerciseId).maybeSingle(),
      ]);
      if (cancelled) return;
      if (!ex) {
        navigate({ to: "/" });
        return;
      }
      setExercise(ex as ExerciseMeta);
      if (u.user) {
        setUserId(u.user.id);
        const { data: p } = await supabase
          .from("profiles")
          .select("personal_bests, best_count")
          .eq("id", u.user.id)
          .maybeSingle();
        if (p) {
          const pb = (p as { personal_bests: Record<string, number> | null }).personal_bests ?? {};
          const fallback = exerciseId === "pushup" ? (p as { best_count: number }).best_count ?? 0 : 0;
          setBest(pb[exerciseId] ?? fallback);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [exerciseId, navigate]);

  // Elapsed timer tick
  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [startedAt]);

  const start = useCallback(async () => {
    if (detection === "motion_vertical" || detection === "combo") {
      const ok = await ensureMotionPermission();
      if (!ok) {
        setMotionError("Bewegungssensor wurde nicht freigegeben.");
        return;
      }
    }
    setActive(true);
    setStartedAt((s) => s ?? Date.now());
    setMotionError(null);
    setSavedHint(null);
  }, [detection]);

  const handleSurfaceTap = useCallback(() => {
    if (detection === "timer" || detection === "motion_vertical") return;
    if (!active) {
      start();
    }
    bump();
  }, [detection, active, start, bump]);

  const finish = async () => {
    if (count <= 0 || !userId || !exercise) {
      resetAll();
      return;
    }
    setSaving(true);
    const duration_ms = startedAt ? Date.now() - startedAt : 0;
    const { error } = await supabase.from("workouts").insert({
      user_id: userId,
      exercise_id: exerciseId,
      count,
      duration_ms,
    });
    if (!error) {
      const newBest = count > best;
      if (newBest) {
        // Read-modify-write personal_bests jsonb.
        const { data: cur } = await supabase
          .from("profiles")
          .select("personal_bests, best_count")
          .eq("id", userId)
          .maybeSingle();
        const pb = ((cur as { personal_bests: Record<string, number> | null } | null)?.personal_bests) ?? {};
        const next = { ...pb, [exerciseId]: count };
        const updates: Record<string, unknown> = { personal_bests: next };
        if (exerciseId === "pushup") updates.best_count = count;
        await supabase.from("profiles").update(updates).eq("id", userId);
        setBest(count);
        setSavedHint(`Neuer Bestwert: ${count}${exercise.unit === "seconds" ? " Sek." : ""}`);
      } else {
        setSavedHint(`Gespeichert: ${count}${exercise.unit === "seconds" ? " Sek." : ""}`);
      }
    } else {
      setSavedHint("Speichern fehlgeschlagen");
    }
    setSaving(false);
    setActive(false);
    setStartedAt(null);
    resetEngine();
  };

  const resetAll = () => {
    setActive(false);
    setStartedAt(null);
    resetEngine();
    setSavedHint(null);
  };

  const elapsed = startedAt ? now - startedAt : 0;
  const pace = startedAt && count > 0 && exercise?.unit !== "seconds"
    ? count / (elapsed / 60000)
    : 0;
  const cfg = exercise ? getConfig(exerciseId) : null;
  const isTapDriven = detection === "touch" || detection === "combo";

  if (!exercise) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center text-sm text-muted-foreground">
        Lade…
      </main>
    );
  }

  return (
    <main className="relative flex min-h-[100dvh] flex-col px-5 pt-6 pb-4">
      <header className="flex items-center justify-between">
        <Link
          to="/"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition"
        >
          <span aria-hidden>←</span>
          <span>Übungen</span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-2xl">{exercise.icon}</span>
          <span className="text-sm font-medium text-foreground">{exercise.name}</span>
        </div>
      </header>

      <section className="mt-6 grid grid-cols-3 gap-3">
        <Stat label="Zeit" value={formatTime(elapsed)} />
        <Stat
          label={exercise.unit === "seconds" ? "Status" : "Tempo"}
          value={exercise.unit === "seconds" ? (active ? "Läuft" : "Aus") : (pace ? pace.toFixed(0) : "—")}
          unit={exercise.unit === "seconds" ? undefined : "/min"}
        />
        <Stat label="Bestwert" value={best.toString()} unit={exercise.unit === "seconds" ? "Sek." : undefined} />
      </section>

      <button
        onPointerDown={handleSurfaceTap}
        aria-label={isTapDriven ? "Antippen" : "Aktiv"}
        className="group relative mt-6 flex flex-1 select-none items-center justify-center overflow-hidden rounded-[2rem] border border-border bg-card/60 backdrop-blur active:bg-card transition-colors"
      >
        {count === 0 && !active && (
          <>
            <span className="pointer-events-none absolute h-40 w-40 rounded-full bg-primary/20 animate-pulse-ring" />
            <span className="pointer-events-none absolute h-40 w-40 rounded-full bg-primary/10 animate-pulse-ring [animation-delay:0.7s]" />
          </>
        )}

        <div className="relative flex flex-col items-center gap-3 px-4 text-center">
          <span className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
            {exercise.name}
          </span>
          <span
            key={pop}
            className="font-display text-[9rem] leading-none font-bold tabular-nums text-foreground animate-count-pop"
            style={{ textShadow: "0 0 40px oklch(0.82 0.19 95 / 0.35)" }}
          >
            {count}
          </span>
          <span className="mt-2 max-w-[16rem] text-sm text-muted-foreground">
            {!active && count === 0
              ? cfg?.idleHint
              : cfg?.activeHint}
          </span>
          {motionError && (
            <span className="text-xs text-destructive">{motionError}</span>
          )}
        </div>

        <Corner className="left-3 top-3" />
        <Corner className="right-3 top-3 rotate-90" />
        <Corner className="right-3 bottom-3 rotate-180" />
        <Corner className="left-3 bottom-3 -rotate-90" />
      </button>

      {!active && count === 0 && !isTapDriven && (
        <button
          onClick={start}
          className="mt-4 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition active:scale-[0.98]"
        >
          Starten
        </button>
      )}

      {(active || count > 0) && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            onClick={resetAll}
            className="rounded-xl border border-border bg-secondary px-4 py-3 text-sm font-medium text-secondary-foreground transition hover:bg-secondary/80 active:scale-[0.98]"
          >
            Verwerfen
          </button>
          <button
            onClick={finish}
            disabled={saving || count === 0}
            className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? "Speichere…" : "Workout speichern"}
          </button>
        </div>
      )}

      <p className="mt-3 text-center text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
        {savedHint ?? (isTapDriven ? "Tippe irgendwo auf die Fläche" : active ? "Erkennung aktiv" : "Bereit zum Start")}
      </p>
    </main>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card/50 px-3 py-3 backdrop-blur">
      <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-xl font-semibold tabular-nums text-foreground">{value}</span>
        {unit && <span className="text-[10px] text-muted-foreground">{unit}</span>}
      </div>
    </div>
  );
}

function Corner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`pointer-events-none absolute h-5 w-5 border-l-2 border-t-2 border-primary/70 ${className}`}
    />
  );
}
