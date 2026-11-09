import { useState } from "react";
import {
  clearMood,
  MOOD_EMOJI,
  MOOD_LABELS,
  getMood,
  setMood,
  type MoodLevel,
} from "@/lib/extra-features";

const LEVELS: MoodLevel[] = [1, 2, 3, 4, 5];

export function MoodCheckin({ userId }: { userId: string }) {
  const [mood, setMoodState] = useState<MoodLevel | null>(() => getMood(userId));
  const [status, setStatus] = useState("");

  return (
    <section className="mt-4 rounded-3xl border border-border bg-card/60 p-4 backdrop-blur">
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        Stimmung heute
      </div>
      <div className="mt-3 flex justify-between gap-1">
        {LEVELS.map((level) => (
          <button
            key={level}
            type="button"
            aria-pressed={mood === level}
            onClick={() => {
              const saved = setMood(userId, level);
              if (saved) setMoodState(level);
              setStatus(
                saved ? "Stimmung ausgewählt." : "Stimmung konnte nicht lokal gespeichert werden.",
              );
            }}
            className={`flex min-h-11 flex-1 flex-col items-center justify-center gap-1 rounded-xl border py-2 transition ${
              mood === level ? "border-primary bg-primary/15" : "border-border bg-secondary/40"
            }`}
          >
            <span className="text-xl leading-none" aria-hidden="true">
              {MOOD_EMOJI[level]}
            </span>
            <span className="text-[9px] text-muted-foreground">{MOOD_LABELS[level]}</span>
          </button>
        ))}
      </div>
      {mood !== null && (
        <button
          type="button"
          className="mt-2 min-h-11 rounded-lg px-2 text-xs text-muted-foreground underline underline-offset-2"
          onClick={() => {
            const removed = clearMood(userId);
            if (removed) setMoodState(null);
            setStatus(
              removed
                ? "Heutiger Stimmungseintrag entfernt."
                : "Eintrag konnte nicht entfernt werden.",
            );
          }}
        >
          Heutigen Eintrag entfernen
        </button>
      )}
      {status && (
        <p role="status" className="mt-1 text-xs text-muted-foreground">
          {status}
        </p>
      )}
    </section>
  );
}
