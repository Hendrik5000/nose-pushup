import { useState } from "react";
import { WATER_GOAL_ML, addWaterMl, getWaterMl, setWaterMl } from "@/lib/extra-features";

export function WaterTracker() {
  const [ml, setMl] = useState(() => getWaterMl());
  const pct = Math.min(1, ml / WATER_GOAL_ML);

  const bump = (amount: number) => setMl(addWaterMl(amount));

  return (
    <section className="mt-4 rounded-3xl border border-border bg-card/60 p-4 backdrop-blur">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Wasser</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">
            {(ml / 1000).toFixed(2)} / {(WATER_GOAL_ML / 1000).toFixed(1)} L
          </div>
        </div>
        <span className="text-3xl" aria-hidden>
          💧
        </span>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-sky-400 transition-all" style={{ width: `${pct * 100}%` }} />
      </div>
      <div className="mt-3 flex gap-2">
        {[250, 500, 750].map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => bump(a)}
            className="flex-1 rounded-xl border border-border bg-secondary/50 py-2 text-xs font-semibold"
          >
            +{a} ml
          </button>
        ))}
        <button
          type="button"
          onClick={() => setMl(setWaterMl(0))}
          className="rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground"
        >
          Reset
        </button>
      </div>
    </section>
  );
}
