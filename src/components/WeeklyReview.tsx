import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShareCard } from "@/components/ShareCard";
import { isNotifyEnabled, showNotification } from "@/lib/notifications";

type DayStat = { day: string; total_reps: number; sessions: number };
type WorkoutRow = { count: number; form_score: number | null; created_at: string };

function mondayOf(offsetWeeks = 0): string {
  const d = new Date();
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow - offsetWeeks * 7);
  return d.toISOString().slice(0, 10);
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

type WeekSummary = {
  weekStart: string;
  reps: number;
  sessions: number;
  activeDays: number;
  bestSet: number;
  avgForm: number | null;
  deltaPct: number | null; // vs Vorwoche
};

/**
 * Wochenrückblick: aggregiert daily_stats + workouts, zeigt diese Woche vs.
 * Vorwoche, teilbar als Bild-Karte. Sonntags optionale Benachrichtigung.
 */
export function WeeklyReview({ userId, streak }: { userId: string | null; streak: number }) {
  const [stats, setStats] = useState<DayStat[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showArchive, setShowArchive] = useState(false);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const from = addDays(mondayOf(0), -28); // 4 Wochen + aktuelle
      const [{ data: ds }, { data: ws }] = await Promise.all([
        supabase
          .from("daily_stats")
          .select("day, total_reps, sessions")
          .eq("user_id", userId)
          .gte("day", from)
          .order("day"),
        supabase
          .from("workouts")
          .select("count, form_score, created_at")
          .eq("user_id", userId)
          .gte("created_at", from)
          .order("created_at"),
      ]);
      setStats((ds ?? []) as DayStat[]);
      setWorkouts((ws ?? []) as WorkoutRow[]);
      setLoaded(true);
    })();
  }, [userId]);

  // Sonntags-Benachrichtigung „Deine Woche ist da"
  useEffect(() => {
    if (!loaded || !isNotifyEnabled()) return;
    if (new Date().getDay() !== 0) return;
    const key = `np-weekly-notified-${mondayOf(0)}`;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, "1");
    void showNotification(
      "Deine Woche ist da 📊",
      "Dein Wochenrückblick wartet — schau rein und teile deine Bilanz.",
      "weekly-review",
      "/",
    );
  }, [loaded]);

  const weeks = useMemo<WeekSummary[]>(() => {
    const out: WeekSummary[] = [];
    for (let w = 3; w >= 0; w--) {
      const start = mondayOf(w);
      const end = addDays(start, 7);
      const days = stats.filter((d) => d.day >= start && d.day < end);
      const wos = workouts.filter((x) => x.created_at.slice(0, 10) >= start && x.created_at.slice(0, 10) < end);
      const reps = days.reduce((s, d) => s + d.total_reps, 0);
      const sessions = days.reduce((s, d) => s + d.sessions, 0);
      const activeDays = days.filter((d) => d.total_reps > 0).length;
      const bestSet = wos.reduce((m, x) => Math.max(m, x.count), 0);
      const forms = wos.map((x) => x.form_score).filter((f): f is number => f != null);
      const avgForm = forms.length
        ? Math.round((forms.reduce((s, f) => s + f, 0) / forms.length) * 10) / 10
        : null;
      out.push({ weekStart: start, reps, sessions, activeDays, bestSet, avgForm, deltaPct: null });
    }
    for (let i = 1; i < out.length; i++) {
      const prev = out[i - 1].reps;
      out[i].deltaPct = prev > 0 ? Math.round(((out[i].reps - prev) / prev) * 100) : null;
    }
    return out;
  }, [stats, workouts]);

  if (!userId || !loaded) return null;
  const current = weeks[weeks.length - 1];
  if (!current || current.reps === 0) return null;

  const deltaLabel =
    current.deltaPct == null
      ? "—"
      : `${current.deltaPct >= 0 ? "+" : ""}${current.deltaPct}% vs. Vorwoche`;

  return (
    <section className="mt-6 rounded-3xl border border-border bg-card/60 p-5 backdrop-blur">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Wochenrückblick
        </h2>
        <span
          className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
            (current.deltaPct ?? 0) >= 0
              ? "bg-green-500/10 text-green-400"
              : "bg-red-500/10 text-red-400"
          }`}
        >
          {deltaLabel}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <ReviewStat label="Reps" value={current.reps.toLocaleString("de-DE")} />
        <ReviewStat label="Sessions" value={`${current.sessions}`} />
        <ReviewStat label="Aktive Tage" value={`${current.activeDays}/7`} />
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        <ReviewStat label="Bester Satz" value={`${current.bestSet}`} />
        <ReviewStat label="Technik" value={current.avgForm != null ? `${current.avgForm}/5` : "—"} />
        <ReviewStat label="Streak" value={`${streak} 🔥`} />
      </div>

      <div className="mt-4">
        <ShareCard
          label="Woche teilen"
          stats={{
            title: "Wochenrückblick",
            headline: `${current.reps.toLocaleString("de-DE")} Reps`,
            subline: `${current.sessions} Sessions · ${current.activeDays} aktive Tage · ${deltaLabel}`,
            rows: [
              { label: "Bester Satz", value: `${current.bestSet}` },
              { label: "Technik-Schnitt", value: current.avgForm != null ? `${current.avgForm} / 5` : "—" },
              { label: "Streak", value: `${streak} Tage` },
            ],
          }}
        />
      </div>

      {weeks.length > 1 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowArchive((s) => !s)}
            className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground transition hover:text-foreground"
          >
            {showArchive ? "Archiv ausblenden ▲" : "Vergangene Wochen ▼"}
          </button>
          {showArchive && (
            <ul className="mt-2 space-y-1.5">
              {weeks
                .slice(0, -1)
                .reverse()
                .map((w) => (
                  <li
                    key={w.weekStart}
                    className="flex items-center justify-between rounded-xl border border-border bg-background/40 px-3 py-2 text-xs"
                  >
                    <span className="text-muted-foreground">
                      KW ab {new Date(w.weekStart + "T00:00:00Z").toLocaleDateString("de-DE", { day: "numeric", month: "short" })}
                    </span>
                    <span className="font-semibold tabular-nums text-foreground">
                      {w.reps.toLocaleString("de-DE")} Reps
                    </span>
                    <span
                      className={`tabular-nums ${
                        (w.deltaPct ?? 0) >= 0 ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {w.deltaPct == null ? "—" : `${w.deltaPct >= 0 ? "+" : ""}${w.deltaPct}%`}
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function ReviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background/40 px-2 py-2.5">
      <div className="text-sm font-semibold tabular-nums text-foreground">{value}</div>
      <div className="mt-0.5 text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}
