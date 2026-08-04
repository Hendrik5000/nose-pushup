import { createFileRoute, Link, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useExerciseEngine, ensureMotionPermission } from "@/hooks/useExerciseEngine";
import { useCameraDetection } from "@/hooks/useCameraDetection";
import { feedbackRep, feedbackSuccess } from "@/lib/feedback";
import type { ExerciseMeta } from "@/lib/exercises";
import { getConfig } from "@/lib/exercises";


type PushMode = "nose" | "manual" | "camera";

export const Route = createFileRoute("/_authenticated/workout/$exerciseId")({
  validateSearch: (search: Record<string, unknown>): { mode?: PushMode } => {
    const raw = search.mode;
    if (raw === "nose" || raw === "manual" || raw === "camera") return { mode: raw };
    return {};
  },
  head: ({ params }) => ({
    meta: [{ title: `${params.exerciseId} — Nosy Push-Ups` }],
  }),
  component: WorkoutScreen,
});

const MOTIVATIONAL = [
  "Atme — und weiter.",
  "Du bist stärker als gestern.",
  "Noch einer. Und noch einer.",
  "Form vor Tempo.",
  "Stark!",
  "Beast-Modus aktiv.",
  "Halte durch — du schaffst das.",
  "Power!",
];

function formatTime(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m.toString().padStart(2, "0")}:${r.toString().padStart(2, "0")}`;
}

function WorkoutScreen() {
  const { exerciseId } = useParams({ from: "/_authenticated/workout/$exerciseId" });
  const search = useSearch({ from: "/_authenticated/workout/$exerciseId" });
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
  const [motivation, setMotivation] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState("");



  const isPushup = exerciseId === "pushup";
  const pushMode: PushMode = isPushup ? (search.mode ?? "nose") : "nose";
  const useCamera = isPushup && pushMode === "camera";
  const useManual = isPushup && pushMode === "manual";

  // Effective detection: for push-ups we honor the mode toggle.
  const detection = useMemo(() => {
    if (!exercise) return "touch" as const;
    if (isPushup) {
      if (useCamera || useManual) return "touch" as const; // driven externally / not at all
      return exercise.detection_type;
    }
    return exercise.detection_type;
  }, [exercise, isPushup, useCamera, useManual]);

  const { count, pop, bump, reset: resetEngine } = useExerciseEngine({
    exerciseId,
    detection,
    active: useCamera ? false : active, // when camera-driven, we bump() from camera
    onTick: (n) => {
      feedbackRep(n);
      if (n > 0 && n % 5 === 0) {
        setMotivation(MOTIVATIONAL[Math.floor(Math.random() * MOTIVATIONAL.length)]);
      }
    },
  });


  // Camera detector — only mounted for camera mode
  const cameraBump = useCallback(() => bump(), [bump]);
  const { videoRef, error: cameraError, ready: cameraReady, status: cameraStatus } = useCameraDetection({
    active: useCamera && active,
    onRep: cameraBump,
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
    if (useCamera) return;
    if (detection === "timer" || detection === "motion_vertical") return;
    if (!active) start();
    bump();
  }, [useCamera, detection, active, start, bump]);

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
      feedbackSuccess();
      const newBest = count > best;

      if (newBest) {
        // Personal bests are updated server-side by the on_workout_inserted trigger.
        setBest(count);
        setSavedHint(`🏆 Neuer Bestwert: ${count}${exercise.unit === "seconds" ? " Sek." : ""}`);
      } else {
        const xpGained = exercise.unit === "seconds"
          ? Math.max(1, Math.floor(duration_ms / 1000))
          : count * 10;
        setSavedHint(`Gespeichert · +${xpGained} XP`);
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
    setMotivation(null);
  };

  const elapsed = startedAt ? now - startedAt : 0;
  const pace = startedAt && count > 0 && exercise?.unit !== "seconds"
    ? count / (elapsed / 60000)
    : 0;
  const cfg = exercise ? getConfig(exerciseId) : null;
  const isTapDriven = !useCamera && (detection === "touch" || detection === "combo");

  if (!exercise) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center text-sm text-muted-foreground">
        Lade…
      </main>
    );
  }

  const modeLabel: Record<PushMode, string> = { nose: "Nase", manual: "Manuell", camera: "Kamera" };

  // Manual mode: user just types how many they did.
  const submitManual = async () => {
    const n = Math.max(0, Math.min(9999, parseInt(manualInput, 10) || 0));
    if (n <= 0 || !userId || !exercise) return;
    setSaving(true);
    const { error } = await supabase.from("workouts").insert({
      user_id: userId,
      exercise_id: exerciseId,
      count: n,
      duration_ms: 0,
    });
    if (!error) {
      feedbackSuccess();
      const newBest = n > best;

      if (newBest) {
        setBest(n);
        setSavedHint(`🏆 Neuer Bestwert: ${n}`);
      } else {
        setSavedHint(`Gespeichert · +${n * 10} XP`);
      }
      setManualInput("");
    } else {
      setSavedHint("Speichern fehlgeschlagen");
    }
    setSaving(false);
  };

  if (useManual) {
    return (
      <main className="relative mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pt-6 pb-4">
        <header className="flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition"
          >
            <span aria-hidden>←</span>
            <span>Zurück</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-2xl">{exercise.icon}</span>
            <span className="text-sm font-medium text-foreground">
              {exercise.name}
              <span className="ml-2 rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                Manuell
              </span>
            </span>
          </div>
        </header>

        <section className="mt-6 grid grid-cols-2 gap-3">
          <Stat label="Bestwert" value={best.toString()} />
          <Stat label="Modus" value="✍️ Manuell" />
        </section>

        <section className="mt-6 flex flex-1 flex-col items-center justify-center rounded-[2rem] border border-border bg-card/60 p-6 text-center backdrop-blur">
          <span className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
            Wie viele Push-Ups?
          </span>
          <input
            type="number"
            inputMode="numeric"
            pattern="[0-9]*"
            min={1}
            max={9999}
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="0"
            className="mt-4 w-full max-w-[14rem] rounded-2xl border border-border bg-background/60 py-4 text-center font-display text-[5rem] font-bold tabular-nums text-foreground focus:border-primary focus:outline-none"
          />
          <p className="mt-4 max-w-[16rem] text-sm text-muted-foreground">
            Trage die Anzahl deiner gerade absolvierten Push-Ups ein und speichere.
          </p>
        </section>

        <button
          onClick={submitManual}
          disabled={saving || !manualInput || parseInt(manualInput, 10) <= 0}
          className="mt-4 w-full rounded-xl bg-primary px-4 py-4 text-sm font-semibold text-primary-foreground transition active:scale-[0.98] disabled:opacity-50"
        >
          {saving ? "Speichere…" : "Workout speichern"}
        </button>

        <p className="mt-3 text-center text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
          {savedHint ?? "Ehrlichkeitsmodus 🙏"}
        </p>
      </main>
    );
  }


  return (
    <main className="relative mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pt-6 pb-4">
      <header className="flex items-center justify-between">
        <Link
          to="/"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition"
        >
          <span aria-hidden>←</span>
          <span>Zurück</span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-2xl">{exercise.icon}</span>
          <span className="text-sm font-medium text-foreground">
            {exercise.name}
            {isPushup && (
              <span className="ml-2 rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                {modeLabel[pushMode]}
              </span>
            )}
          </span>
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
        {useCamera && (
          <video
            ref={videoRef}
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-25"
            playsInline
            muted
          />
        )}

        {count === 0 && !active && !useCamera && (
          <>
            <span className="pointer-events-none absolute h-40 w-40 rounded-full bg-primary/20 animate-pulse-ring" />
            <span className="pointer-events-none absolute h-40 w-40 rounded-full bg-primary/10 animate-pulse-ring [animation-delay:0.7s]" />
          </>
        )}

        <div className="relative z-10 flex flex-col items-center gap-3 px-4 text-center">
          <span className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
            {isPushup ? `Push-Ups · ${modeLabel[pushMode]}` : exercise.name}
          </span>
          <span
            key={pop}
            className="font-display text-[9rem] leading-none font-bold tabular-nums text-foreground animate-count-pop"
            style={{ textShadow: "0 0 40px oklch(0.82 0.19 95 / 0.35)" }}
          >
            {count}
          </span>
          <span className="mt-2 max-w-[16rem] text-sm text-muted-foreground">
            {motivation ?? (!active && count === 0 ? cfg?.idleHint : cfg?.activeHint)}
          </span>
          {motionError && <span className="text-xs text-destructive">{motionError}</span>}
          {useCamera && cameraError && (
            <span className="text-xs text-destructive">{cameraError}</span>
          )}
          {useCamera && active && !cameraReady && !cameraError && (
            <span className="text-xs text-muted-foreground">{cameraStatus}</span>
          )}
          {useCamera && cameraReady && (
            <span className="text-[10px] uppercase tracking-[0.2em] text-primary/80">
              🤖 KI · {cameraStatus}
            </span>
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
        {savedHint ??
          (useCamera
            ? active
              ? "Kamera erkennt dich"
              : "Starten · Kamera-Modus"
            : isTapDriven
            ? "Tippe irgendwo auf die Fläche"
            : active
            ? "Erkennung aktiv"
            : "Bereit zum Start")}
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
