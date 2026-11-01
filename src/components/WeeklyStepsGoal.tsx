import { useState } from "react";
import { getStepsGoal, setStepsGoal } from "@/lib/extra-features";
import { measuredHealthValue } from "@/lib/health-glance";

export function WeeklyStepsGoal({ todaySteps }: { todaySteps: number | null }) {
  const [goal, setGoal] = useState(() => getStepsGoal());
  const measuredSteps = measuredHealthValue(todaySteps);
  const pct = measuredSteps === null ? null : Math.min(1, measuredSteps / goal);

  return (
    <section className="mt-4 rounded-3xl border border-border bg-card/60 p-4 backdrop-blur">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Schritt-Ziel
          </div>
          <div className="mt-1 text-xl font-semibold tabular-nums">
            {measuredSteps === null
              ? "Noch nicht erfasst"
              : `${measuredSteps.toLocaleString("de-DE")} / ${goal.toLocaleString("de-DE")}`}
          </div>
        </div>
        <span className="text-3xl">👟</span>
      </div>
      {pct !== null ? (
        <div
          className="mt-3 h-2 w-full overflow-hidden rounded-full bg-secondary"
          role="progressbar"
          aria-label="Tagesfortschritt zum Schritt-Ziel"
          aria-valuemin={0}
          aria-valuemax={goal}
          aria-valuenow={Math.min(measuredSteps ?? 0, goal)}
        >
          <div
            className="h-full rounded-full bg-emerald-400 transition-all"
            style={{ width: `${pct * 100}%` }}
          />
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">Ziel-Fortschritt unbekannt</p>
      )}
      <div className="mt-3 flex gap-2">
        {[6000, 8000, 10000, 12000].map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => {
              setStepsGoal(g);
              setGoal(g);
            }}
            className={`flex-1 rounded-lg border py-1.5 text-[10px] font-semibold ${
              goal === g ? "border-primary bg-primary/15" : "border-border"
            }`}
          >
            {(g / 1000).toFixed(0)}k
          </button>
        ))}
      </div>
    </section>
  );
}
