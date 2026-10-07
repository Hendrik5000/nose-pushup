import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  computeReadiness,
  recordReadiness,
  readinessHistory,
  type Readiness,
} from "@/lib/readiness";

/**
 * Prominenter Readiness-Score auf der Startseite: Ampel + 14-Tage-Verlauf.
 * Daten: health_entries (Schlaf/Schritte), workouts (7 Tage), Profil-Streak,
 * Cali-Check-in (lokal).
 */
export function ReadinessCard({ streak }: { streak: number }) {
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [history, setHistory] = useState<{ day: string; score: number }[]>([]);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const today = new Date().toISOString().slice(0, 10);
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();

      const [{ data: he }, { count }] = await Promise.all([
        supabase
          .from("health_entries")
          .select("sleep_min, steps")
          .eq("user_id", u.user.id)
          .eq("day", today)
          .maybeSingle(),
        supabase
          .from("workouts")
          .select("id", { count: "exact", head: true })
          .eq("user_id", u.user.id)
          .gte("created_at", sevenDaysAgo),
      ]);

      const r = computeReadiness({
        sleepMin: (he as { sleep_min?: number } | null)?.sleep_min ?? null,
        steps: (he as { steps?: number } | null)?.steps ?? null,
        workoutsLast7Days: count ?? 0,
        streak,
      });
      recordReadiness(r.score);
      setReadiness(r);
      setHistory(readinessHistory());
    })();
  }, [streak]);

  if (!readiness) return null;

  const barColor =
    readiness.level === "green"
      ? "bg-green-400"
      : readiness.level === "yellow"
        ? "bg-yellow-400"
        : "bg-red-400";

  return (
    <section className="mt-4 rounded-3xl border border-border bg-card/60 p-4 backdrop-blur">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Readiness
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg">{readiness.emoji}</span>
          <span className="text-lg font-semibold tabular-nums">{readiness.score}</span>
        </div>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${readiness.score}%` }}
        />
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-foreground">{readiness.label}</div>
          <p className="mt-1 text-xs text-muted-foreground">{readiness.detail}</p>
        </div>
      </div>

      {history.length > 1 && (
        <div className="mt-4">
          <div className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
            Letzte {history.length} Tage
          </div>
          <div className="mt-2 flex h-10 items-end gap-1">
            {history.map((h) => (
              <div
                key={h.day}
                title={`${h.day}: ${h.score}`}
                className={`flex-1 rounded-sm ${
                  h.score >= 70 ? "bg-green-400/70" : h.score >= 45 ? "bg-yellow-400/70" : "bg-red-400/70"
                }`}
                style={{ height: `${Math.max(15, h.score)}%` }}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
