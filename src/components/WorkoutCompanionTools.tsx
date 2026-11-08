import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { WorkoutScreenLock } from "@/components/WorkoutScreenLock";
import {
  CIRCUIT_OPTIONS,
  readWorkoutCircuit,
  saveWorkoutCircuit,
  sideBalance,
  suggestNextRepTarget,
  timeBudgetRemainingSeconds,
  type CircuitExerciseId,
} from "@/lib/workout-companion";

const WARMUP_STEPS = [
  { title: "Schultern und Handgelenke lockern", seconds: 30 },
  { title: "Hüfte und Sprunggelenke mobilisieren", seconds: 30 },
  { title: "Leichte Einstiegsbewegungen", seconds: 30 },
];
const TEMPO_PRESETS = [
  { label: "2 s runter · 2 s hoch", down: 2, up: 2 },
  { label: "3 s runter · 1 s hoch", down: 3, up: 1 },
  { label: "4 s runter · 2 s hoch", down: 4, up: 2 },
] as const;
const REP_RANGES = [
  { label: "6–8", min: 6, max: 8 },
  { label: "8–12", min: 8, max: 12 },
  { label: "12–15", min: 12, max: 15 },
] as const;

export function WorkoutCompanionTools({
  userId,
  exerciseId,
  exerciseName,
  active,
}: {
  userId: string | null;
  exerciseId: string;
  exerciseName: string;
  active: boolean;
}) {
  const [circuit, setCircuit] = useState<CircuitExerciseId[]>([]);
  const [circuitStatus, setCircuitStatus] = useState("");
  const [circuitChoice, setCircuitChoice] = useState<CircuitExerciseId>("pushup");
  const [minimumReps, setMinimumReps] = useState(8);
  const [maximumReps, setMaximumReps] = useState(12);
  const [targetReps, setTargetReps] = useState(10);
  const [rpe, setRpe] = useState(7);
  const [repSuggestion, setRepSuggestion] = useState<number | null>(null);
  const [leftCount, setLeftCount] = useState(0);
  const [rightCount, setRightCount] = useState(0);
  const [warmupStep, setWarmupStep] = useState(-1);
  const [warmupRemaining, setWarmupRemaining] = useState(0);
  const [warmupEndsAt, setWarmupEndsAt] = useState<number | null>(null);
  const [tempoPresetIndex, setTempoPresetIndex] = useState(0);
  const [tempoRunning, setTempoRunning] = useState(false);
  const [tempoPhase, setTempoPhase] = useState<"down" | "up">("down");
  const [tempoRemaining, setTempoRemaining] = useState(0);
  const [tempoDeadline, setTempoDeadline] = useState<number | null>(null);
  const tempoDeadlineRef = useRef<number | null>(null);
  const [budgetMinutes, setBudgetMinutes] = useState(12);
  const [budgetStartedAt, setBudgetStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const balance = sideBalance(leftCount, rightCount);
  const timeRemaining =
    budgetStartedAt === null
      ? null
      : timeBudgetRemainingSeconds(budgetMinutes, budgetStartedAt, now);

  useEffect(() => {
    setCircuit(userId ? readWorkoutCircuit(userId) : []);
    setCircuitStatus("");
  }, [userId]);

  useEffect(() => {
    if (!circuit.includes(circuitChoice)) return;
    const fallback = CIRCUIT_OPTIONS.find((exercise) => !circuit.includes(exercise.id));
    if (fallback) setCircuitChoice(fallback.id);
  }, [circuit, circuitChoice]);

  const storeCircuit = (next: CircuitExerciseId[]) => {
    setCircuit(next);
    setCircuitStatus(
      saveWorkoutCircuit(userId ?? "", next)
        ? "Zirkel auf diesem Gerät gespeichert."
        : "Nur vorübergehend verfügbar; lokaler Speicher nicht verfügbar.",
    );
  };

  const addCircuitExercise = () => {
    if (circuit.length >= 4 || circuit.includes(circuitChoice)) return;
    storeCircuit([...circuit, circuitChoice]);
  };

  const moveCircuitExercise = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= circuit.length) return;
    const next = [...circuit];
    [next[index], next[target]] = [next[target], next[index]];
    storeCircuit(next);
  };

  const advanceWarmup = useCallback(() => {
    const next = warmupStep + 1;
    if (next >= WARMUP_STEPS.length) {
      setWarmupStep(-1);
      setWarmupEndsAt(null);
      setWarmupRemaining(0);
      return;
    }
    setWarmupStep(next);
    setWarmupRemaining(WARMUP_STEPS[next].seconds);
    setWarmupEndsAt(Date.now() + WARMUP_STEPS[next].seconds * 1000);
  }, [warmupStep]);

  useEffect(() => {
    if (warmupEndsAt === null) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((warmupEndsAt - Date.now()) / 1000));
      setWarmupRemaining(remaining);
      if (remaining === 0) setWarmupEndsAt(null);
    };
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [warmupEndsAt]);

  useEffect(() => {
    if (!tempoRunning || tempoDeadline === null) return;
    const preset = TEMPO_PRESETS[tempoPresetIndex];
    const tick = () => {
      if (tempoDeadlineRef.current !== tempoDeadline) return;
      const remaining = Math.max(0, Math.ceil((tempoDeadline - Date.now()) / 1000));
      setTempoRemaining(remaining);
      if (remaining > 0) return;
      const nextPhase = tempoPhase === "down" ? "up" : "down";
      const duration = nextPhase === "down" ? preset.down : preset.up;
      const nextDeadline = Date.now() + duration * 1000;
      tempoDeadlineRef.current = nextDeadline;
      setTempoPhase(nextPhase);
      setTempoRemaining(duration);
      setTempoDeadline(nextDeadline);
    };
    tick();
    const timer = window.setInterval(tick, 200);
    return () => window.clearInterval(timer);
  }, [tempoDeadline, tempoPhase, tempoPresetIndex, tempoRunning]);

  useEffect(() => {
    if (budgetStartedAt === null) return;
    let timer: number | null = null;
    const tick = () => {
      const current = Date.now();
      setNow(current);
      if (
        timer !== null &&
        timeBudgetRemainingSeconds(budgetMinutes, budgetStartedAt, current) === 0
      ) {
        window.clearInterval(timer);
        timer = null;
      }
    };
    timer = window.setInterval(tick, 500);
    tick();
    return () => {
      if (timer !== null) window.clearInterval(timer);
    };
  }, [budgetMinutes, budgetStartedAt]);

  const startWarmup = () => {
    setWarmupStep(0);
    setWarmupRemaining(WARMUP_STEPS[0].seconds);
    setWarmupEndsAt(Date.now() + WARMUP_STEPS[0].seconds * 1000);
  };

  const startTempo = () => {
    const deadline = Date.now() + TEMPO_PRESETS[tempoPresetIndex].down * 1000;
    tempoDeadlineRef.current = deadline;
    setTempoPhase("down");
    setTempoRemaining(TEMPO_PRESETS[tempoPresetIndex].down);
    setTempoDeadline(deadline);
    setTempoRunning(true);
  };

  const chooseRepRange = (minimum: number, maximum: number) => {
    setMinimumReps(minimum);
    setMaximumReps(maximum);
    setTargetReps(Math.round((minimum + maximum) / 2));
    setRepSuggestion(null);
  };

  const circuitLabel = (id: string) =>
    CIRCUIT_OPTIONS.find((exercise) => exercise.id === id)?.label ?? id;
  const availableCircuitOptions = CIRCUIT_OPTIONS.filter(
    (exercise) => !circuit.includes(exercise.id),
  );

  return (
    <div className="space-y-2">
      <WorkoutScreenLock userId={userId} active={active} />
      <details className="rounded-3xl border border-border bg-card/55 p-4">
        <summary className="min-h-11 cursor-pointer list-none text-sm font-semibold">
          <span className="mr-2 text-primary" aria-hidden="true">
            ＋
          </span>
          Trainingshelfer für {exerciseName}
          <span className="ml-2 text-[11px] font-normal text-muted-foreground">
            6 optionale Werkzeuge
          </span>
        </summary>
        <div className="mt-4 space-y-3">
          <section
            className="rounded-2xl border border-border/70 bg-background/40 p-3"
            aria-labelledby="warmup-title"
          >
            <h3 id="warmup-title" className="text-sm font-semibold">
              Geführtes 90-Sekunden-Warm-up
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Drei kurze Vorbereitungsschritte. Wenn etwas unangenehm ist, überspringe den Schritt.
            </p>
            {warmupStep < 0 ? (
              <button
                type="button"
                onClick={startWarmup}
                className="mt-3 min-h-11 w-full rounded-xl border border-border px-3 text-sm font-medium"
              >
                Warm-up starten
              </button>
            ) : (
              <div className="mt-3 rounded-xl bg-card p-3" aria-live="polite">
                <p className="text-sm font-semibold">
                  Schritt {warmupStep + 1} von {WARMUP_STEPS.length}:{" "}
                  {WARMUP_STEPS[warmupStep].title}
                </p>
                <p className="mt-1 font-display text-3xl font-bold tabular-nums text-primary">
                  {warmupRemaining}s
                </p>
                <button
                  type="button"
                  onClick={advanceWarmup}
                  className="mt-2 min-h-11 w-full rounded-xl border border-border px-3 text-sm"
                >
                  {warmupStep === WARMUP_STEPS.length - 1 ? "Warm-up beenden" : "Nächster Schritt"}
                </button>
              </div>
            )}
          </section>

          <section
            className="rounded-2xl border border-border/70 bg-background/40 p-3"
            aria-labelledby="tempo-title"
          >
            <h3 id="tempo-title" className="text-sm font-semibold">
              Visueller Tempocoach
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Stilles Absenken-/Hochkommen-Timing, ohne Ton oder automatische Wiederholungszählung.
            </p>
            <div className="mt-3 flex gap-2">
              <select
                aria-label="Tempo wählen"
                value={tempoPresetIndex}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setTempoPresetIndex(next);
                  setTempoRunning(false);
                  setTempoDeadline(null);
                  tempoDeadlineRef.current = null;
                }}
                className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm"
              >
                {TEMPO_PRESETS.map((preset, index) => (
                  <option key={preset.label} value={index}>
                    {preset.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() =>
                  tempoRunning
                    ? (setTempoRunning(false),
                      setTempoDeadline(null),
                      (tempoDeadlineRef.current = null))
                    : startTempo()
                }
                className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
              >
                {tempoRunning ? "Stop" : "Start"}
              </button>
            </div>
            {tempoRunning && (
              <div className="mt-3 rounded-xl bg-card px-3 py-4 text-center" aria-live="polite">
                <span className="text-sm font-semibold">
                  {tempoPhase === "down" ? "Kontrolliert absenken" : "Kontrolliert hochkommen"}
                </span>
                <span className="mt-1 block font-display text-3xl font-bold tabular-nums text-primary">
                  {tempoRemaining}s
                </span>
              </div>
            )}
          </section>

          <section
            className="rounded-2xl border border-border/70 bg-background/40 p-3"
            aria-labelledby="circuit-title"
          >
            <h3 id="circuit-title" className="text-sm font-semibold">
              Persönlicher Zirkelplaner
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Wähle 2–4 Stationen und ordne sie. Jede Übung wird wie gewohnt separat geöffnet und
              gespeichert.
            </p>
            <div className="mt-3 flex gap-2">
              <select
                aria-label="Übung für Zirkel wählen"
                value={circuitChoice}
                onChange={(event) => setCircuitChoice(event.target.value as CircuitExerciseId)}
                className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm"
                disabled={availableCircuitOptions.length === 0}
              >
                {availableCircuitOptions.map((exercise) => (
                  <option key={exercise.id} value={exercise.id}>
                    {exercise.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={addCircuitExercise}
                disabled={circuit.length >= 4 || availableCircuitOptions.length === 0}
                className="min-h-11 rounded-xl border border-border px-3 text-sm font-medium disabled:opacity-50"
              >
                Hinzufügen
              </button>
            </div>
            {circuit.length > 0 && (
              <ol className="mt-3 space-y-2">
                {circuit.map((id, index) => (
                  <li
                    key={id}
                    className={`flex items-center gap-2 rounded-xl border p-2 ${id === exerciseId ? "border-primary/50 bg-primary/5" : "border-border/70 bg-card/50"}`}
                  >
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="mr-2 text-xs text-muted-foreground">{index + 1}.</span>
                      {circuitLabel(id)}
                    </span>
                    <button
                      type="button"
                      aria-label={`${circuitLabel(id)} nach oben`}
                      disabled={index === 0}
                      onClick={() => moveCircuitExercise(index, -1)}
                      className="min-h-9 min-w-9 rounded-lg border border-border disabled:opacity-40"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label={`${circuitLabel(id)} nach unten`}
                      disabled={index === circuit.length - 1}
                      onClick={() => moveCircuitExercise(index, 1)}
                      className="min-h-9 min-w-9 rounded-lg border border-border disabled:opacity-40"
                    >
                      ↓
                    </button>
                    <Link
                      to="/workout/$exerciseId"
                      params={{ exerciseId: id }}
                      className="min-h-9 rounded-lg bg-primary/15 px-3 py-2 text-xs font-semibold text-foreground"
                    >
                      Start
                    </Link>
                    <button
                      type="button"
                      aria-label={`${circuitLabel(id)} aus Zirkel entfernen`}
                      onClick={() => storeCircuit(circuit.filter((item) => item !== id))}
                      className="min-h-9 min-w-9 rounded-lg border border-border text-muted-foreground"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ol>
            )}
            {circuit.length >= 2 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Dein Zirkel: {circuit.map(circuitLabel).join(" → ")}
              </p>
            )}
            <p className="mt-2 text-[11px] text-muted-foreground" role="status" aria-live="polite">
              {circuitStatus}
            </p>
          </section>

          <section
            className="rounded-2xl border border-border/70 bg-background/40 p-3"
            aria-labelledby="rep-range-title"
          >
            <h3 id="rep-range-title" className="text-sm font-semibold">
              Autoregulierte Wiederholungen
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Passe den nächsten Satz an dein Gefühl an; Alo ändert deinen Trainingsplan nicht
              automatisch.
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {REP_RANGES.map((range) => (
                <button
                  key={range.label}
                  type="button"
                  aria-pressed={minimumReps === range.min && maximumReps === range.max}
                  onClick={() => chooseRepRange(range.min, range.max)}
                  className={`min-h-10 rounded-xl border text-xs font-semibold ${minimumReps === range.min && maximumReps === range.max ? "border-primary bg-primary/15" : "border-border"}`}
                >
                  {range.label} Wdh.
                </button>
              ))}
            </div>
            <label className="mt-3 block text-xs text-muted-foreground">
              Ziel des letzten Satzes
              <input
                type="number"
                min={minimumReps}
                max={maximumReps}
                value={targetReps}
                onChange={(event) =>
                  setTargetReps(
                    Math.max(
                      minimumReps,
                      Math.min(maximumReps, Number(event.target.value) || minimumReps),
                    ),
                  )
                }
                className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground"
              />
            </label>
            <label className="mt-3 block text-xs text-muted-foreground">
              Anstrengung (RPE 1–10)
              <input
                type="range"
                min={1}
                max={10}
                value={rpe}
                onChange={(event) => setRpe(Number(event.target.value))}
                className="mt-2 w-full accent-primary"
              />
              <span className="text-sm font-semibold text-foreground">{rpe}/10</span>
            </label>
            <button
              type="button"
              onClick={() =>
                setRepSuggestion(suggestNextRepTarget(targetReps, minimumReps, maximumReps, rpe))
              }
              className="mt-3 min-h-11 w-full rounded-xl border border-border px-3 text-sm font-medium"
            >
              Nächsten Satz vorschlagen
            </button>
            {repSuggestion !== null && (
              <p className="mt-2 rounded-xl bg-primary/10 p-3 text-sm font-semibold" role="status">
                Vorschlag: {repSuggestion} Wiederholungen im nächsten Satz.
              </p>
            )}
          </section>

          <section
            className="rounded-2xl border border-border/70 bg-background/40 p-3"
            aria-labelledby="balance-title"
          >
            <h3 id="balance-title" className="text-sm font-semibold">
              Links-rechts-Ausgleich
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Optionaler Zähler für einseitige Übungen; die Werte gelten nur für diese Ansicht.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setLeftCount((value) => value + 1)}
                className="min-h-12 rounded-xl border border-border px-3 text-sm font-semibold"
              >
                Links · {leftCount} ＋
              </button>
              <button
                type="button"
                onClick={() => setRightCount((value) => value + 1)}
                className="min-h-12 rounded-xl border border-border px-3 text-sm font-semibold"
              >
                Rechts · {rightCount} ＋
              </button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
              {balance.leading === "even"
                ? "Gleichstand"
                : `${balance.difference} ${balance.difference === 1 ? "Wiederholung" : "Wiederholungen"} mehr ${balance.leading === "left" ? "links" : "rechts"}`}
            </p>
            <button
              type="button"
              onClick={() => {
                setLeftCount(0);
                setRightCount(0);
              }}
              className="mt-2 min-h-10 rounded-xl border border-border px-3 text-xs"
            >
              Zähler zurücksetzen
            </button>
          </section>

          <section
            className="rounded-2xl border border-border/70 bg-background/40 p-3"
            aria-labelledby="time-budget-title"
          >
            <h3 id="time-budget-title" className="text-sm font-semibold">
              Trainingszeitfenster
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Setze dir ein Zeitbudget. Beim Ablauf wird nichts gestoppt oder gespeichert.
            </p>
            <div className="mt-3 flex gap-2">
              <select
                aria-label="Zeitbudget auswählen"
                value={budgetMinutes}
                onChange={(event) => {
                  setBudgetMinutes(Number(event.target.value));
                  setBudgetStartedAt(null);
                }}
                className="min-h-11 flex-1 rounded-xl border border-border bg-background px-3 text-sm"
              >
                {[8, 12, 20, 30].map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes} Minuten
                  </option>
                ))}
              </select>
              {budgetStartedAt === null ? (
                <button
                  type="button"
                  onClick={() => {
                    setNow(Date.now());
                    setBudgetStartedAt(Date.now());
                  }}
                  className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
                >
                  Start
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setBudgetStartedAt(null)}
                  className="min-h-11 rounded-xl border border-border px-4 text-sm"
                >
                  Stop
                </button>
              )}
            </div>
            {timeRemaining !== null && (
              <p
                className="mt-3 font-display text-2xl font-bold tabular-nums text-primary"
                role="timer"
                aria-live="off"
              >
                {Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, "0")}
                {timeRemaining === 0 && (
                  <span className="ml-2 text-sm font-medium text-muted-foreground">
                    Zeitfenster vorbei
                  </span>
                )}
              </p>
            )}
          </section>
        </div>
      </details>
    </div>
  );
}
