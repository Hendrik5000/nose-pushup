import { useState } from "react";
import {
  MOOD_EMOJI,
  MOOD_LABELS,
  getMood,
  setMood,
  type MoodLevel,
} from "@/lib/extra-features";

const LEVELS: MoodLevel[] = [1, 2, 3, 4, 5];

export function MoodCheckin() {
  const [mood, setMoodState] = useState<MoodLevel | null>(() => getMood());

  return (
    <section className="mt-4 rounded-3xl border border-border bg-card/60 p-4 backdrop-blur">
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Stimmung heute</div>
      <div className="mt-3 flex justify-between gap-1">
        {LEVELS.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => {
              setMood(l);
              setMoodState(l);
            }}
            className={`flex flex-1 flex-col items-center gap-1 rounded-xl border py-2 transition ${
              mood === l
                ? "border-primary bg-primary/15"
                : "border-border bg-secondary/40"
            }`}
          >
            <span className="text-xl leading-none">{MOOD_EMOJI[l]}</span>
            <span className="text-[9px] text-muted-foreground">{MOOD_LABELS[l]}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
