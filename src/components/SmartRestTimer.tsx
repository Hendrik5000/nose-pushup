import { useEffect, useState } from "react";
import { formatRest, suggestRest, type RestSuggestion } from "@/lib/rest-timer";
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
  const [left, setLeft] = useState(suggestion.seconds);
  const [running, setRunning] = useState(true);

  useEffect(() => {
    if (!running || left <= 0) return;
    const id = window.setInterval(() => {
      setLeft((s) => {
        if (s <= 1) {
          window.clearInterval(id);
          feedbackRep();
          speak("Pause vorbei");
          onDone?.();
          return 0;
        }
        if (s === 4) speak("Noch drei");
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, left, onDone]);

  const pct = Math.max(0, Math.min(1, left / suggestion.seconds));

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
          className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
        >
          Überspringen
        </button>
      </div>

      <div className="mt-4 text-center">
        <div className="font-display text-5xl font-bold tabular-nums text-foreground">
          {formatRest(left)}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{suggestion.reason}</p>
      </div>

      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary transition-all duration-1000 linear"
          style={{ width: `${pct * 100}%` }}
        />
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => setRunning((r) => !r)}
          className="flex-1 rounded-xl border border-border bg-secondary py-2.5 text-sm font-medium text-foreground"
        >
          {running ? "Pause" : "Weiter"}
        </button>
        <button
          type="button"
          onClick={() => setLeft((s) => s + 15)}
          className="rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm font-medium text-foreground"
        >
          +15s
        </button>
      </div>
    </div>
  );
}
