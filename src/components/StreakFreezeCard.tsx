import { useState } from "react";
import {
  activateFreezeToday,
  freezesRemaining,
  isTodayFrozen,
  FREEZES_PER_MONTH,
} from "@/lib/streak-freeze";
import { feedbackSuccess } from "@/lib/feedback";

export function StreakFreezeCard({ streak }: { streak: number }) {
  const [remaining, setRemaining] = useState(freezesRemaining);
  const [frozen, setFrozen] = useState(isTodayFrozen);
  const [msg, setMsg] = useState<string | null>(null);

  const useFreeze = () => {
    if (frozen) {
      setMsg("Heute ist bereits ein Freeze aktiv.");
      return;
    }
    if (remaining <= 0) {
      setMsg("Keine Freezes mehr diesen Monat.");
      return;
    }
    const ok = activateFreezeToday();
    if (ok) {
      feedbackSuccess();
      setFrozen(true);
      setRemaining(freezesRemaining());
      setMsg("Streak für heute geschützt ❄️");
    }
  };

  return (
    <section className="mt-4 rounded-3xl border border-border bg-card/60 p-4 backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Streak Freeze
          </div>
          <h2 className="mt-1 text-sm font-semibold text-foreground">
            {frozen ? "Heute geschützt" : "Streak absichern"}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {FREEZES_PER_MONTH} Freezes pro Monat. Aktuell {streak} Tage Streak.
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl">{frozen ? "❄️" : "🔥"}</div>
          <div className="mt-1 text-[11px] font-semibold tabular-nums text-primary">
            {remaining} übrig
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={useFreeze}
        disabled={frozen || remaining <= 0}
        className="mt-3 w-full rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition active:scale-[0.98] disabled:opacity-40"
      >
        {frozen ? "Freeze aktiv" : "Freeze für heute aktivieren"}
      </button>
      {msg && (
        <p className="mt-2 text-center text-[11px] text-muted-foreground">{msg}</p>
      )}
    </section>
  );
}
