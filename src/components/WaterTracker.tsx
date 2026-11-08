import { useState } from "react";
import {
  WATER_GOAL_ML,
  addWaterMl,
  getWaterMl,
  parseWaterAmount,
  setWaterMl,
  undoWaterMl,
} from "@/lib/extra-features";

export function WaterTracker({ userId }: { userId: string }) {
  const [ml, setMl] = useState(() => getWaterMl(userId));
  const [lastAdded, setLastAdded] = useState(0);
  const [customAmount, setCustomAmount] = useState("");
  const [status, setStatus] = useState("");
  const pct = Math.min(1, ml / WATER_GOAL_ML);
  const remaining = Math.max(0, WATER_GOAL_ML - ml);

  const bump = (amount: number): boolean => {
    const saved = addWaterMl(userId, amount);
    if (saved === null) {
      setStatus("Wasserwert konnte lokal nicht gespeichert werden. Bitte erneut versuchen.");
      return false;
    }
    setMl(saved);
    setLastAdded(amount);
    setStatus(`${amount} ml hinzugefügt.`);
    return true;
  };

  const addCustom = () => {
    const amount = parseWaterAmount(customAmount);
    if (amount === null) {
      setStatus("Gib eine ganze Menge von 10 bis 2.000 ml ein.");
      return;
    }
    if (bump(amount)) setCustomAmount("");
  };

  const undoLast = () => {
    if (lastAdded <= 0) return;
    const saved = undoWaterMl(userId, lastAdded);
    if (saved === null) {
      setStatus("Wasserwert konnte nicht geändert werden. Bitte erneut versuchen.");
      return;
    }
    setMl(saved);
    setStatus(`${lastAdded} ml rückgängig gemacht.`);
    setLastAdded(0);
  };

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
        <div
          className="h-full rounded-full bg-sky-400 transition-all"
          style={{ width: `${pct * 100}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
        {remaining > 0
          ? `${remaining.toLocaleString("de-DE")} ml bis zum Tagesziel`
          : "Tagesziel erreicht"}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {[250, 500, 750].map((amount) => (
          <button
            key={amount}
            type="button"
            onClick={() => bump(amount)}
            className="min-h-11 flex-1 rounded-xl border border-border bg-secondary/50 px-3 text-xs font-semibold"
          >
            +{amount} ml
          </button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="alo-water-custom-amount">
          Eigene Wassermenge in Millilitern
        </label>
        <input
          id="alo-water-custom-amount"
          type="number"
          min={10}
          max={2000}
          step={10}
          inputMode="numeric"
          value={customAmount}
          onChange={(event) => setCustomAmount(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") addCustom();
          }}
          placeholder="Eigene ml"
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-background/60 px-3 text-sm"
        />
        <button
          type="button"
          onClick={addCustom}
          className="min-h-11 rounded-xl border border-border bg-secondary/50 px-3 text-xs font-semibold"
        >
          Hinzufügen
        </button>
        <button
          type="button"
          onClick={undoLast}
          disabled={lastAdded === 0}
          className="min-h-11 rounded-xl border border-border px-3 text-xs text-muted-foreground disabled:opacity-50"
        >
          Rückgängig
        </button>
        <button
          type="button"
          onClick={() => {
            const saved = setWaterMl(userId, 0);
            if (saved === null) {
              setStatus("Wasserwert konnte nicht zurückgesetzt werden. Bitte erneut versuchen.");
              return;
            }
            setMl(saved);
            setLastAdded(0);
            setStatus("Tageswert zurückgesetzt.");
          }}
          className="min-h-11 rounded-xl border border-border px-3 text-xs text-muted-foreground"
        >
          Reset
        </button>
      </div>
      {status && (
        <p role="status" className="mt-2 text-xs text-muted-foreground">
          {status}
        </p>
      )}
    </section>
  );
}
