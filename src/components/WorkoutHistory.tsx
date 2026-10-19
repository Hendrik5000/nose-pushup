/**
 * WorkoutHistory — last 35 days heatmap + weekly bar chart.
 * Reads from daily_stats.total_reps and workouts (for exercise breakdown).
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getTrainingWeekBounds, localDateKey } from "@/lib/training-dates";
import { readWorkoutMetadata } from "@/lib/workout-session";

type WorkoutRow = {
  id: string;
  created_at: string;
  exercise_id: string;
  count: number;
};

const DAYS = 35; // 5 weeks

function dateStr(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  return localDateKey(d);
}

function dayOfWeek(dateStr: string): number {
  // 0 = Mon … 6 = Sun
  const d = new Date(dateStr + "T12:00:00");
  return (d.getDay() + 6) % 7;
}

function intensity(reps: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (reps === 0 || max === 0) return 0;
  const pct = reps / max;
  if (pct < 0.25) return 1;
  if (pct < 0.5) return 2;
  if (pct < 0.75) return 3;
  return 4;
}

const CELL_COLORS: Record<number, string> = {
  0: "bg-muted/40",
  1: "bg-primary/20",
  2: "bg-primary/40",
  3: "bg-primary/70",
  4: "bg-primary",
};

const DAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const WEEKDAY_ABBR = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export function WorkoutHistory({ userId }: { userId: string }) {
  const [stats, setStats] = useState<Map<string, number>>(new Map());
  const [recentWorkouts, setRecentWorkouts] = useState<WorkoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const fromDate = dateStr(DAYS - 1);
      const today = dateStr(0);

      const rows: WorkoutRow[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase
          .from("workouts")
          .select("id, created_at, exercise_id, count")
          .eq("user_id", userId)
          .gte("created_at", new Date(fromDate + "T00:00:00").toISOString())
          .lte("created_at", new Date().toISOString())
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(offset, offset + 499);
        if (error) {
          setLoadError(true);
          break;
        }
        rows.push(...(data ?? []));
        if (!data || data.length < 500) break;
      }
      const map = new Map<string, number>();
      for (const row of rows) {
        if (row.exercise_id !== "pushup") continue;
        const day = localDateKey(new Date(row.created_at));
        map.set(day, (map.get(day) ?? 0) + row.count);
      }
      setStats(map);
      setRecentWorkouts(rows);
      setLoading(false);
    })();
  }, [userId]);

  // Build 5-week grid (35 cells, oldest first)
  const days: string[] = [];
  for (let i = DAYS - 1; i >= 0; i--) days.push(dateStr(i));

  const maxWiederholungen = Math.max(1, ...Array.from(stats.values()));

  // Pad so the grid starts on Monday
  const firstDow = dayOfWeek(days[0]);
  const padBefore = firstDow; // how many empty cells before first day

  // Weekly totals (last 7 days grouped by weekday) for mini bar chart
  const weeklyTotals = Array(7).fill(0) as number[];
  for (let i = 0; i < 7; i++) {
    const d = dateStr(6 - i);
    weeklyTotals[i] = stats.get(d) ?? 0;
  }
  const weekMax = Math.max(1, ...weeklyTotals);

  // Group recent workouts by date for tooltip-like detail
  const byDate = new Map<string, { exercise_id: string; count: number }[]>();
  recentWorkouts.forEach((w) => {
    const d = w.created_at.slice(0, 10);
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d)!.push({ exercise_id: w.exercise_id, count: w.count });
  });

  const week = getTrainingWeekBounds();
  const totalThisWeek = Array.from(stats.entries()).reduce(
    (sum, [day, count]) => (day >= week.startDay && day < week.endDayExclusive ? sum + count : sum),
    0,
  );
  const trainedDays = days.filter((d) => (stats.get(d) ?? 0) > 0).length;

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card/50 p-4 text-center text-xs text-muted-foreground backdrop-blur">
        Lade Verlauf…
      </div>
    );
  }

  if (loadError)
    return (
      <p role="alert" className="rounded-2xl border border-border p-4 text-sm">
        Verlauf konnte nicht vollständig geladen werden. Bitte lade die Seite erneut.
      </p>
    );
  if (!recentWorkouts.length)
    return (
      <section className="rounded-2xl border border-border bg-card p-4">
        <h3 className="font-semibold">Noch keine Daten</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Speichere dein erstes Training. Hier erscheinen dann deine Einheiten und dein Fortschritt.
        </p>
      </section>
    );
  return (
    <div className="rounded-2xl border border-border bg-card/50 p-4 backdrop-blur space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Verlauf
        </h3>
        <div className="flex gap-3 text-[10px] text-muted-foreground">
          <span>
            <span className="font-semibold text-foreground">{trainedDays}</span> Tage
          </span>
          <span>
            <span className="font-semibold text-foreground">
              {totalThisWeek.toLocaleString("de-DE")}
            </span>{" "}
            Liegestütze diese Woche
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-primary/20 bg-primary/10 px-3 py-2 text-xs text-foreground">
        <span className="font-semibold">Momentum:</span>{" "}
        {trainedDays >= 5
          ? "Du bist im Flow und bleibst konsistent."
          : "Ein paar kleine Sessions reichen schon, um den Rhythmus zu halten."}
      </div>

      {/* 7-day bar chart */}
      <div className="flex items-end gap-1 h-14">
        {weeklyTotals.map((reps, i) => {
          const pct = reps / weekMax;
          const isToday = i === 6;
          return (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div className="w-full flex-1 flex items-end">
                <div
                  className={`w-full rounded-sm transition-all duration-500 ${
                    isToday ? "bg-primary" : "bg-primary/40"
                  }`}
                  style={{ height: `${Math.max(4, Math.round(pct * 100))}%` }}
                />
              </div>
              <span
                className={`text-[9px] ${isToday ? "text-primary font-bold" : "text-muted-foreground"}`}
              >
                {WEEKDAY_ABBR[i]}
              </span>
            </div>
          );
        })}
      </div>

      {/* 5-week heatmap */}
      <div>
        <div className="grid grid-cols-7 gap-[3px] text-[8px] text-muted-foreground mb-1">
          {DAY_LABELS.map((l) => (
            <div key={l} className="text-center">
              {l}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-[3px]">
          {/* padding before first day */}
          {Array(padBefore)
            .fill(null)
            .map((_, i) => (
              <div key={`pad-${i}`} className="aspect-square" />
            ))}
          {days.map((d) => {
            const reps = stats.get(d) ?? 0;
            const level = intensity(reps, maxWiederholungen);
            const isToday = d === dateStr(0);
            return (
              <div
                key={d}
                title={reps > 0 ? `${d}: ${reps} Wiederholungen` : d}
                className={`aspect-square rounded-[3px] ${CELL_COLORS[level]} ${
                  isToday ? "ring-1 ring-primary ring-offset-1 ring-offset-background" : ""
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* Recent sessions */}
      {recentWorkouts.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Letzte Trainings
          </div>
          {recentWorkouts.slice(0, 6).map((w, i) => {
            const meta = readWorkoutMetadata(localStorage, userId, w.id);
            const date = new Date(w.created_at).toLocaleDateString("de-DE", {
              weekday: "short",
              day: "numeric",
              month: "short",
            });
            const label = w.exercise_id.startsWith("cali_")
              ? w.exercise_id
                  .replace("cali_", "")
                  .replace(/_/g, " ")
                  .replace(/\b\w/g, (c) => c.toUpperCase())
              : w.exercise_id.charAt(0).toUpperCase() + w.exercise_id.slice(1);
            return (
              <div
                key={w.id}
                className="flex items-center justify-between rounded-xl bg-secondary/40 px-3 py-2"
              >
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-foreground">{label}</span>
                  <span className="text-xs text-muted-foreground">
                    {meta
                      ? meta.partial
                        ? "Teiltraining"
                        : "Plan abgeschlossen"
                      : "Training gespeichert"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{date}</span>
                </div>
                <div className="text-sm font-semibold tabular-nums text-foreground">
                  {w.count}
                  <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                    {w.exercise_id.startsWith("cali_") || w.exercise_id === "plank" ? "Sek." : ""}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
