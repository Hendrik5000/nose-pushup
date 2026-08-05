import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Challenge = {
  id: string;
  title: string;
  description: string;
  icon: string;
  period: "daily" | "weekly";
  goal_type: string;
  goal_value: number;
  xp_reward: number;
  sort_order: number;
};

type UserChallenge = {
  challenge_id: string;
  period_start: string;
  progress: number;
  completed_at: string | null;
};

function periodStart(period: "daily" | "weekly", d = new Date()): string {
  if (period === "daily") return d.toISOString().slice(0, 10);
  // ISO week Monday
  const day = d.getUTCDay() || 7;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - (day - 1));
  return monday.toISOString().slice(0, 10);
}

export function ChallengesPanel({ userId }: { userId: string }) {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [progress, setProgress] = useState<Record<string, UserChallenge>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"daily" | "weekly">("daily");

  useEffect(() => {
    (async () => {
      const today = new Date();
      const dailyStart = periodStart("daily", today);
      const weeklyStart = periodStart("weekly", today);
      const [{ data: ch }, { data: uc }] = await Promise.all([
        supabase
          .from("challenges")
          .select("*")
          .eq("active", true)
          .order("sort_order"),
        supabase
          .from("user_challenges")
          .select("challenge_id, period_start, progress, completed_at")
          .eq("user_id", userId)
          .in("period_start", [dailyStart, weeklyStart]),
      ]);
      if (ch) setChallenges(ch as Challenge[]);
      if (uc) {
        const map: Record<string, UserChallenge> = {};
        for (const row of uc as UserChallenge[]) map[row.challenge_id] = row;
        setProgress(map);
      }
      setLoading(false);
    })();
  }, [userId]);

  const active = challenges.filter((c) => c.period === tab);

  return (
    <section className="mt-6 rounded-3xl border border-border bg-card/60 p-5 backdrop-blur">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Challenges
        </h2>
        <div className="flex gap-1 rounded-full border border-border bg-secondary p-0.5 text-[10px] font-semibold uppercase tracking-wider">
          <button
            onClick={() => setTab("daily")}
            className={`rounded-full px-3 py-1 transition ${
              tab === "daily" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            Täglich
          </button>
          <button
            onClick={() => setTab("weekly")}
            className={`rounded-full px-3 py-1 transition ${
              tab === "weekly" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            Woche
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/10 p-3 text-sm text-foreground">
        <div className="font-semibold">Bleib dran – kleine Schritte zählen</div>
        <div className="mt-1 text-xs text-muted-foreground">
          Schließe heute ein Ziel ab und bringe deinen Streak sicher über den nächsten Tag.
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {loading && (
          <li className="rounded-2xl border border-border bg-background/40 p-4 text-center text-xs text-muted-foreground">
            Lade Challenges…
          </li>
        )}
        {!loading && active.length === 0 && (
          <li className="rounded-2xl border border-border bg-background/40 p-4 text-center text-xs text-muted-foreground">
            Keine Challenges aktiv.
          </li>
        )}
        {active.map((c) => {
          const uc = progress[c.id];
          const done = !!uc?.completed_at;
          const cur = Math.min(uc?.progress ?? 0, c.goal_value);
          const pct = Math.round((cur / c.goal_value) * 100);
          return (
            <li
              key={c.id}
              className={`rounded-2xl border p-3 transition ${
                done
                  ? "border-primary/40 bg-primary/10"
                  : "border-border bg-background/40"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="text-2xl leading-none">{c.icon}</span>
                  <div>
                    <div className="text-sm font-semibold text-foreground">{c.title}</div>
                    <div className="text-xs text-muted-foreground">{c.description}</div>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                    Reward
                  </div>
                  <div className="text-xs font-semibold text-primary">+{c.xp_reward} XP</div>
                </div>
              </div>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className={`h-full rounded-full transition-all ${
                    done ? "bg-primary" : "bg-primary/70"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="mt-1 flex justify-between text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <span className="tabular-nums">
                  {cur} / {c.goal_value}
                </span>
                <span>{done ? "✓ Abgeschlossen" : `${pct}%`}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
