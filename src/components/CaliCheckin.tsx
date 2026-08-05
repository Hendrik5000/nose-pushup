import { useState } from "react";
import { getTodayKey, saveCheckin, type CheckinData } from "@/lib/calisthenics";

type Props = {
  existing: CheckinData | null;
  onSave: (data: CheckinData) => void;
};

const ENERGY_LABELS = ["", "Erschöpft", "Müde", "Normal", "Gut", "Top-Form 🔥"];
const SORENESS_LABELS = ["", "Kein", "Leicht", "Spürbar", "Stark", "Schmerz ⚠️"];

export function CaliCheckin({ existing, onSave }: Props) {
  const [energy, setEnergy] = useState<number>(existing?.energy ?? 3);
  const [soreness, setSoreness] = useState<number>(existing?.soreness ?? 1);
  const [saved, setSaved] = useState(!!existing);

  function handleSave() {
    const data: CheckinData = { energy, soreness, date: getTodayKey() };
    saveCheckin(data);
    setSaved(true);
    onSave(data);
  }

  if (saved) {
    return (
      <div className="rounded-2xl border border-border bg-card/50 p-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="text-2xl">✅</span>
          <div>
            <p className="text-sm font-semibold text-foreground">Tages-Check-in erledigt</p>
            <p className="text-xs text-muted-foreground">
              Energie: {ENERGY_LABELS[energy]} · Gelenke: {SORENESS_LABELS[soreness]}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 backdrop-blur">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xl">🧭</span>
        <div>
          <p className="text-sm font-semibold">Tages-Check-in</p>
          <p className="text-[11px] text-muted-foreground">Wie fühlst du dich heute?</p>
        </div>
      </div>

      {/* Energie */}
      <div className="mb-4">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
            Energielevel
          </span>
          <span className="text-xs font-semibold text-foreground">{ENERGY_LABELS[energy]}</span>
        </div>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((v) => (
            <button
              key={v}
              onClick={() => setEnergy(v)}
              className={`h-8 flex-1 rounded-lg border text-sm font-semibold transition ${
                energy === v
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-secondary/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Gelenkschmerz */}
      <div className="mb-4">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
            Gelenke / Schmerz
          </span>
          <span className="text-xs font-semibold text-foreground">{SORENESS_LABELS[soreness]}</span>
        </div>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((v) => (
            <button
              key={v}
              onClick={() => setSoreness(v)}
              className={`h-8 flex-1 rounded-lg border text-sm font-semibold transition ${
                soreness === v
                  ? soreness >= 4
                    ? "border-red-500 bg-red-500/20 text-red-400"
                    : "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-secondary/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleSave}
        className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition active:scale-[0.98]"
      >
        Check-in speichern
      </button>
    </div>
  );
}
