/**
 * WorkoutHistory — last 35 days heatmap + weekly bar chart.
 * Reads from daily_stats.total_reps and workouts (for exercise breakdown).
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getTrainingWeekBounds, localDateKey } from "@/lib/training-dates";
import { readWorkoutMetadata } from "@/lib/workout-session";
import {
  filterWorkoutHistory,
  formatWorkoutDaySummary,
  historyExercise,
  loadWorkoutHistory,
  serializeWorkoutHistoryCsv,
  summarizeWorkoutDays,
  workoutHistoryStartDay,
  type HistoryWorkout,
  type WorkoutHistoryRange,
} from "@/lib/workout-history";
import { TrainingStudio } from "./TrainingStudio";

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
  const [attempt, setAttempt] = useState(0);
  const [rangeDays, setRangeDays] = useState<WorkoutHistoryRange>(35);
  const [exerciseFilter, setExerciseFilter] = useState("all");
  const [copyStatus, setCopyStatus] = useState("");
  const [history, setHistory] = useState<{
    ownerId: string;
    status: "loading" | "ready" | "error";
    rows: HistoryWorkout[];
  }>({ ownerId: userId, status: "loading", rows: [] });

  useEffect(() => {
    let cancelled = false;
    setHistory({ ownerId: userId, status: "loading", rows: [] });
    if (!userId) return;
    void (async () => {
      const fromDate = workoutHistoryStartDay(rangeDays);
      const until = new Date().toISOString();
      try {
        const rows = await loadWorkoutHistory(
          (from, to) =>
            supabase
              .from("workouts")
              .select("id, created_at, exercise_id, count")
              .eq("user_id", userId)
              .gte("created_at", new Date(fromDate + "T00:00:00").toISOString())
              .lte("created_at", until)
              .order("created_at", { ascending: false })
              .order("id", { ascending: false })
              .range(from, to),
          () => cancelled,
        );
        if (!cancelled && rows !== null) setHistory({ ownerId: userId, status: "ready", rows });
      } catch {
        if (!cancelled) setHistory({ ownerId: userId, status: "error", rows: [] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, attempt, rangeDays]);

  // Ownership is checked during render, before a changed user's effect runs.
  const loading = history.ownerId !== userId || history.status === "loading";
  const loadError = history.ownerId === userId && history.status === "error";
  const recentWorkouts =
    history.ownerId === userId && history.status === "ready" ? history.rows : [];
  const filteredSessions = filterWorkoutHistory(recentWorkouts, exerciseFilter);
  const daySummaries = summarizeWorkoutDays(filteredSessions);
  const stats = new Map<string, number>();
  for (const row of recentWorkouts) {
    if (row.exercise_id !== "pushup") continue;
    const day = localDateKey(new Date(row.created_at));
    if (day < dateStr(DAYS - 1)) continue;
    stats.set(day, (stats.get(day) ?? 0) + row.count);
  }
  const exerciseOptions = [...new Set(recentWorkouts.map((row) => row.exercise_id))].sort((a, b) =>
    historyExercise(a).name.localeCompare(historyExercise(b).name, "de"),
  );

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

  const week = getTrainingWeekBounds();
  const totalThisWeek = Array.from(stats.entries()).reduce(
    (sum, [day, count]) => (day >= week.startDay && day < week.endDayExclusive ? sum + count : sum),
    0,
  );
  const trainedDays = days.filter((d) => (stats.get(d) ?? 0) > 0).length;
  const rangeControl = (
    <label className="flex min-h-11 items-center gap-2 text-xs text-muted-foreground">
      Einheiten
      <select
        aria-label="Zeitraum für Trainingsverlauf"
        value={rangeDays}
        onChange={(event) => setRangeDays(Number(event.target.value) as WorkoutHistoryRange)}
        className="min-h-11 rounded-lg border border-border bg-background px-2 text-foreground"
      >
        <option value={35}>35 Tage</option>
        <option value={90}>90 Tage</option>
        <option value={180}>180 Tage</option>
      </select>
    </label>
  );
  const copySummary = async (summary: (typeof daySummaries)[number]) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(formatWorkoutDaySummary(summary));
      setCopyStatus("Tageszusammenfassung kopiert.");
    } catch {
      setCopyStatus("Kopieren ist in diesem Browser nicht verfügbar.");
    }
  };
  const downloadCsv = () => {
    const blob = new Blob(["\uFEFF", serializeWorkoutHistoryCsv(filteredSessions)], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `alo-trainingsverlauf-${rangeDays}-tage.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card/50 p-4 text-center text-xs text-muted-foreground backdrop-blur">
        <div className="mb-2 flex justify-center">{rangeControl}</div>
        Lade Verlauf…
      </div>
    );
  }

  if (loadError)
    return (
      <div role="alert" className="rounded-2xl border border-border p-4 text-sm">
        <p>Verlauf konnte nicht vollständig geladen werden.</p>
        <div className="mt-2">{rangeControl}</div>
        <button
          type="button"
          className="mt-2 min-h-11 font-medium text-primary"
          onClick={() => setAttempt((value) => value + 1)}
        >
          Erneut versuchen
        </button>
      </div>
    );
  if (!recentWorkouts.length)
    return (
      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-2">{rangeControl}</div>
        <h3 className="font-semibold">Noch keine Daten</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          In den letzten {rangeDays} Tagen wurden keine Einheiten gefunden. Hier erscheinen deine
          letzten Trainings und dein Fortschritt.
        </p>
        <div className="mt-3">
          <TrainingStudio userId={userId} rows={recentWorkouts} rangeDays={rangeDays} />
        </div>
      </section>
    );
  return (
    <div className="rounded-2xl border border-border bg-card/50 p-4 backdrop-blur space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Verlauf
        </h3>
        {rangeControl}
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
          <span>
            <span className="font-semibold text-foreground">{trainedDays}</span> Tage mit
            Liegestützen
          </span>
          <span>
            <span className="font-semibold text-foreground">
              {totalThisWeek.toLocaleString("de-DE")}
            </span>{" "}
            Liegestütze diese Woche
          </span>
        </div>
      </div>
      {copyStatus && (
        <p role="status" className="text-xs text-muted-foreground">
          {copyStatus}
        </p>
      )}

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
                {WEEKDAY_ABBR[dayOfWeek(dateStr(6 - i))]}
              </span>
            </div>
          );
        })}
      </div>

      {/* 5-week heatmap */}
      <div>
        <div className="grid grid-cols-7 gap-[3px] text-[10px] text-muted-foreground mb-1">
          {DAY_LABELS.map((l) => (
            <div key={l} className="text-center">
              {l}
            </div>
          ))}
        </div>
        <div
          className="grid grid-cols-7 gap-[3px]"
          role="group"
          aria-label="Trainingsaktivität nach Tag der letzten fünf Wochen"
        >
          {/* padding before first day */}
          {Array(padBefore)
            .fill(null)
            .map((_, i) => (
              <div key={`pad-${i}`} className="aspect-square" aria-hidden="true" />
            ))}
          {days.map((d) => {
            const reps = stats.get(d) ?? 0;
            const level = intensity(reps, maxWiederholungen);
            const isToday = d === dateStr(0);
            return (
              <div
                key={d}
                title={reps > 0 ? `${d}: ${reps} Wiederholungen` : d}
                role="img"
                aria-label={`${d}: ${reps} Wiederholungen`}
                className={`aspect-square rounded-[3px] ${CELL_COLORS[level]} ${
                  isToday ? "ring-1 ring-primary ring-offset-1 ring-offset-background" : ""
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* Daily summaries complement, but never replace, individual sessions. */}
      {daySummaries.length > 0 && (
        <section aria-label="Tageszusammenfassungen" className="space-y-2">
          <h4 className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
            Tageszusammenfassungen
          </h4>
          {daySummaries.map((summary) => (
            <div
              key={`${summary.day}-${summary.exerciseId}`}
              className="flex items-center justify-between rounded-xl border border-border/60 bg-card/60 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground">{summary.name}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(`${summary.day}T12:00:00`).toLocaleDateString("de-DE", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}{" "}
                  · {summary.sessions} {summary.sessions === 1 ? "Session" : "Sessions"}
                </p>
              </div>
              <div className="ml-3 flex shrink-0 items-center gap-2">
                <p className="text-xs font-semibold tabular-nums text-foreground">
                  {summary.total.toLocaleString("de-DE")}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    {summary.unit === "seconds" ? "Sek." : summary.unit === "reps" ? "Wdh." : ""}
                  </span>
                </p>
                <button
                  type="button"
                  aria-label={`Tageszusammenfassung kopieren: ${summary.name}`}
                  className="min-h-11 rounded-lg px-2 text-xs text-primary"
                  onClick={() => void copySummary(summary)}
                >
                  Kopieren
                </button>
              </div>
            </div>
          ))}
        </section>
      )}
      {/* Recent sessions */}
      {recentWorkouts.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Letzte Trainings
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor="alo-history-exercise-filter">
                Trainings nach Übung filtern
              </label>
              <select
                id="alo-history-exercise-filter"
                aria-label="Trainings nach Übung filtern"
                value={exerciseFilter}
                onChange={(event) => setExerciseFilter(event.target.value)}
                className="min-h-11 rounded-lg border border-border bg-background px-2 text-xs"
              >
                <option value="all">Alle Übungen</option>
                {exerciseOptions.map((id) => (
                  <option key={id} value={id}>
                    {historyExercise(id).name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={filteredSessions.length === 0}
                onClick={downloadCsv}
                className="min-h-11 rounded-lg border border-border px-3 text-xs font-medium disabled:opacity-50"
              >
                CSV herunterladen
              </button>
            </div>
          </div>
          {filteredSessions.length === 0 && (
            <p className="rounded-xl border border-border/60 px-3 py-2 text-xs text-muted-foreground">
              Für diese Übung wurden im Zeitraum keine Einheiten gefunden.
            </p>
          )}
          {filteredSessions.slice(0, 6).map((w) => {
            let meta = null;
            try {
              meta = readWorkoutMetadata(window.localStorage, userId, w.id);
            } catch {
              // Browsers may deny access to localStorage entirely; history still works.
            }
            const date = new Date(w.created_at).toLocaleDateString("de-DE", {
              weekday: "short",
              day: "numeric",
              month: "short",
            });
            const exercise = historyExercise(w.exercise_id);
            return (
              <div
                key={w.id}
                className="flex items-center justify-between rounded-xl bg-secondary/40 px-3 py-2"
              >
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-foreground">{exercise.name}</span>
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
                    {exercise.unit === "seconds" ? "Sek." : exercise.unit === "reps" ? "Wdh." : ""}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <TrainingStudio userId={userId} rows={recentWorkouts} rangeDays={rangeDays} />
    </div>
  );
}
