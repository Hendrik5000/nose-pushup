import { useState } from "react";
import { getStepsGoal, setStepsGoal } from "@/lib/extra-features";

export function WeeklyStepsGoal({ todaySteps }: { todaySteps: number }) {
  const [goal, setGoal] = useState(() => getStepsGoal());
  const pct = Math.min(1, todaySteps / goal);

  return (
    <section className="mt-4 rounded-3xl border border-border bg-card/60 p-4 backdrop-blur">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Schritt-Ziel</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">
            {todaySteps.toLocaleString("de-DE")} / {goal.toLocaleString("de-DE")}
          </div>
        </div>
        <span className="text-3xl">👟</span>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${pct * 100}%` }} />
      </div>
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
