import { useEffect, useRef, useState } from "react";
import {
  adjustRestSeconds,
  formatRest,
  resetRestSeconds,
  runRestCompletionOnce,
  suggestRest,
  type RestSuggestion,
} from "@/lib/rest-timer";
import { speak } from "@/lib/voice";
import { feedbackRep } from "@/lib/feedback";

type Props = {
  rpe?: number | null;
  formScore?: number | null;
  exerciseId?: string;
  onDone?: () => void;
  onSkip?: () => void;
};

export function SmartRestTimer({ rpe, formScore, exerciseId, onDone, onSkip }: Props) {
  const suggestion: RestSuggestion = suggestRest({ rpe, formScore, exerciseId });
  const suggestedSeconds = resetRestSeconds(suggestion.seconds);
  const [left, setLeft] = useState(suggestedSeconds);
  const [running, setRunning] = useState(true);
  const completionCalled = useRef(false);
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (!running || left <= 0) return;
    const id = window.setTimeout(() => {
      if (left <= 1) {
        setLeft(0);
        setRunning(false);
        runRestCompletionOnce(completionCalled, () => {
          feedbackRep();
          speak("Pause vorbei");
          onDoneRef.current?.();
        });
        return;
      }
      if (left === 4) speak("Noch drei");
      setLeft((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearTimeout(id);
  }, [running, left]);

  const pct = suggestedSeconds > 0 ? Math.max(0, Math.min(1, left / suggestedSeconds)) : 0;
  const extend = (seconds: number) => {
    const next = adjustRestSeconds(left, seconds);
    if (left <= 0 && next > 0) completionCalled.current = false;
    setLeft(next);
  };

  return (
    <div className="rounded-3xl border border-border bg-card/70 p-5 backdrop-blur">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Smart Rest · {suggestion.label}
        </div>
        <button
          type="button"
          onClick={() => {
            setRunning(false);
            onSkip?.();
          }}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Überspringen
        </button>
      </div>

      <div className="mt-4 text-center">
        <div className="font-display text-5xl font-bold tabular-nums text-foreground">
          {formatRest(left)}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{suggestion.reason}</p>
        {suggestion.usedDefaults && (
          <p className="mt-1 text-xs text-muted-foreground" role="status">
            Fehlender oder ungültiger RPE-/Formwert: Standardwerte verwendet.
          </p>
        )}
        {left === 0 && (
          <p
            className="mt-1 text-xs font-medium text-primary"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            Pause beendet.
          </p>
        )}
      </div>

      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary transition-all duration-1000 linear motion-reduce:transition-none"
          style={{ width: `${pct * 100}%` }}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={left === 0}
          onClick={() => setRunning((value) => !value)}
          className="min-h-11 flex-1 rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
        >
          {running ? "Pause" : "Weiter"}
        </button>
        <button
          type="button"
          onClick={() => extend(15)}
          className="min-h-11 rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          +15s
        </button>
        <button
          type="button"
          onClick={() => extend(30)}
          className="min-h-11 rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          +30s
        </button>
        <button
          type="button"
          onClick={() => {
            completionCalled.current = false;
            setLeft(suggestedSeconds);
            setRunning(true);
          }}
          className="min-h-11 rounded-xl border border-border bg-secondary px-3 py-2.5 text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Empfehlung
        </button>
      </div>
    </div>
  );
}
