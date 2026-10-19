import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  buildRecoveryWeek,
  summarizeJoints,
  JOINT_ICONS,
  JOINT_LABELS,
  type DayLoad,
  type JointSummary,
} from "@/lib/recovery-calendar";

export function RecoveryCalendar({ userId }: { userId: string | null }) {
  const [week, setWeek] = useState<DayLoad[]>([]);
  const [loading, setLoading] = useState(true);
  const [workoutCount, setWorkoutCount] = useState(0);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const since = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data, error } = await supabase
        .from("workouts")
        .select("exercise_id, count, created_at")
        .eq("user_id", userId)
        .gte("created_at", since)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      setLoadError(!!error);
      setWorkoutCount(data?.length ?? 0);
      setWeek(
        buildRecoveryWeek(
          (data ?? []) as { exercise_id: string; count: number; created_at: string }[],
        ),
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const summary: JointSummary[] = useMemo(() => summarizeJoints(week), [week]);

  if (!userId) return null;

  return (
    <section className="mt-4 rounded-3xl border border-border bg-card/60 p-4 backdrop-blur">
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        Belastung & Erholung
      </div>
      <h2 className="mt-1 text-sm font-semibold text-foreground">Gelenke & Belastung</h2>
      <p className="mt-2 text-xs text-muted-foreground">
        Trainingsschätzung aus gespeicherten Übungen der letzten 7 Tage; keine gemessene
        Gelenkbelastung oder körperliche Regeneration. Lokale Selbsteinschätzungen werden nicht als
        Kontodaten verwendet.
      </p>

      {loading ? (
        <p className="mt-3 text-xs text-muted-foreground">Lade…</p>
      ) : loadError ? (
        <p role="alert" className="mt-3 text-xs">
          Trainingsdaten konnten nicht geladen werden.
        </p>
      ) : workoutCount === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Noch keine Daten. Nach dem ersten gespeicherten Training erscheint eine vorsichtige
          Belastungsschätzung.
        </p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {summary.map((j) => (
              <div
                key={j.joint}
                className={`rounded-2xl border p-2 text-center ${
                  j.level === "red"
                    ? "border-red-400/40 bg-red-400/10"
                    : j.level === "yellow"
                      ? "border-yellow-400/40 bg-yellow-400/10"
                      : "border-green-400/40 bg-green-400/10"
                }`}
              >
                <div className="text-lg leading-none">{JOINT_ICONS[j.joint]}</div>
                <div className="mt-1 text-[10px] font-medium text-foreground">
                  {JOINT_LABELS[j.joint]}
                </div>
                <div className="mt-0.5 text-[9px] text-muted-foreground">{j.label}</div>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <div className="mb-1 flex justify-between text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
              <span>7 Tage</span>
              <span>Belastung</span>
            </div>
            <div className="flex gap-1">
              {week.map((d) => {
                const total = d.loads.wrist + d.loads.shoulder + d.loads.elbow + d.loads.core;
                const intensity = Math.min(1, total / 8);
                const dayLabel = d.day.slice(8);
                return (
                  <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className="w-full rounded-md bg-primary/20"
                      style={{
                        height: `${12 + intensity * 28}px`,
                        opacity: 0.35 + intensity * 0.65,
                        background:
                          intensity > 0.7
                            ? "oklch(0.65 0.18 25)"
                            : intensity > 0.35
                              ? "oklch(0.8 0.15 90)"
                              : "oklch(0.75 0.14 150)",
                      }}
                      title={`${d.day}: Last ${total}`}
                    />
                    <span className="text-[9px] tabular-nums text-muted-foreground">
                      {dayLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
