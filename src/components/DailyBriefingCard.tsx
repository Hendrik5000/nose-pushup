import { getMood, MOOD_EMOJI, getWaterMl, WATER_GOAL_ML } from "@/lib/extra-features";
import { getWatchSnapshot } from "@/lib/smartwatch";
import { getHcCachedSummary } from "@/lib/health-connect";

export function DailyBriefingCard({
  streak,
  todayReps,
  goal,
  readinessScore,
}: {
  streak: number;
  todayReps: number;
  goal: number;
  readinessScore?: number;
}) {
  const mood = typeof window !== "undefined" ? getMood() : null;
  const water = typeof window !== "undefined" ? getWaterMl() : 0;
  const watch = typeof window !== "undefined" ? getWatchSnapshot() : null;
  const hc = typeof window !== "undefined" ? getHcCachedSummary() : null;
  const steps = hc?.steps ?? watch?.steps ?? 0;

  const lines: string[] = [];
  if (readinessScore != null) {
    if (readinessScore < 45) lines.push("Heute eher regenerieren — leichte Mobility.");
    else if (readinessScore < 70) lines.push("Solide Basis — ein moderater Block passt.");
    else lines.push("Hohe Readiness — du kannst pushen.");
  }
  if (todayReps < goal) lines.push(`Noch ${goal - todayReps} Reps bis zum Tagesziel.`);
  else lines.push("Tagesziel bei den Reps erreicht ✓");
  if (streak > 0) lines.push(`Streak: ${streak} Tag${streak === 1 ? "" : "e"}.`);

  const hour = new Date().getHours();
  const hello = hour < 11 ? "Guten Morgen" : hour < 18 ? "Hallo" : "Guten Abend";

  return (
    <section className="mt-4 rounded-3xl border border-primary/25 bg-primary/5 p-4">
      <div className="text-[10px] uppercase tracking-[0.2em] text-primary">Daily Briefing</div>
      <h2 className="mt-1 text-lg font-semibold">
        {hello} {mood ? MOOD_EMOJI[mood] : "👋"}
      </h2>
      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
        {lines.map((l) => (
          <li key={l}>• {l}</li>
        ))}
        <li>
          • Wasser {(water / 1000).toFixed(1)} L · Schritte{" "}
          {steps ? steps.toLocaleString("de-DE") : "—"}
        </li>
      </ul>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${Math.min(100, (water / WATER_GOAL_ML) * 100)}%` }}
        />
      </div>
    </section>
  );
}
