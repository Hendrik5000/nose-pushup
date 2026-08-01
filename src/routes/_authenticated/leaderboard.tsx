import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/_authenticated/leaderboard")({
  head: () => ({
    meta: [{ title: "Leaderboard — Nosy Push-Ups" }],
  }),
  component: LeaderboardPage,
});

type PublicProfile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  level: number | null;
  xp: number | null;
  current_streak: number | null;
  longest_streak: number | null;
  best_count: number | null;
  battle_wins: number | null;
};

type Scope = "global" | "friends";
type Metric = "xp" | "best_count" | "current_streak" | "battle_wins";

const METRIC_LABEL: Record<Metric, string> = {
  xp: "XP",
  best_count: "Bestwert",
  current_streak: "Streak",
  battle_wins: "Wins",
};

function LeaderboardPage() {
  const [scope, setScope] = useState<Scope>("global");
  const [metric, setMetric] = useState<Metric>("xp");
  const [userId, setUserId] = useState<string | null>(null);
  const [rows, setRows] = useState<PublicProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      setUserId(u.user?.id ?? null);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!userId) return;
      setLoading(true);
      let ids: string[] | null = null;
      if (scope === "friends") {
        const { data: fs } = await supabase
          .from("friendships" as never)
          .select("requester_id, addressee_id, status")
          .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
          .eq("status", "accepted");
        const friendIds = ((fs ?? []) as unknown as Array<{
          requester_id: string;
          addressee_id: string;
        }>).map((f) => (f.requester_id === userId ? f.addressee_id : f.requester_id));
        ids = [...friendIds, userId];
      }
      let query = supabase
        .from("public_profiles" as never)
        .select("id, display_name, avatar_url, level, xp, current_streak, longest_streak, best_count, battle_wins")
        .order(metric, { ascending: false })
        .limit(50);
      if (ids) query = query.in("id", ids);
      const { data } = await query;
      setRows((data ?? []) as unknown as PublicProfile[]);
      setLoading(false);
    })();
  }, [userId, scope, metric]);

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pt-6 pb-10">
      <header className="flex items-center justify-between">
        <Link
          to="/"
          className="text-xs uppercase tracking-[0.25em] text-muted-foreground hover:text-foreground transition"
        >
          ← Zurück
        </Link>
        <span className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
          Leaderboard
        </span>
        <span className="w-10" />
      </header>

      <section className="mt-6 space-y-3">
        <div className="flex rounded-full border border-border bg-background/60 p-0.5 text-[10px] uppercase tracking-[0.18em]">
          <Tab active={scope === "global"} onClick={() => setScope("global")}>
            Global
          </Tab>
          <Tab active={scope === "friends"} onClick={() => setScope("friends")}>
            Freunde
          </Tab>
        </div>
        <div className="flex overflow-x-auto rounded-full border border-border bg-background/60 p-0.5 text-[10px] uppercase tracking-[0.18em]">
          {(Object.keys(METRIC_LABEL) as Metric[]).map((m) => (
            <Tab key={m} active={metric === m} onClick={() => setMetric(m)}>
              {METRIC_LABEL[m]}
            </Tab>
          ))}
        </div>
      </section>

      <section className="mt-5 space-y-2">
        {loading && (
          <p className="rounded-2xl border border-border bg-card/40 p-4 text-center text-sm text-muted-foreground">
            Lade…
          </p>
        )}
        {!loading && rows.length === 0 && (
          <p className="rounded-2xl border border-border bg-card/40 p-4 text-center text-sm text-muted-foreground">
            Noch keine Einträge.
          </p>
        )}
        {!loading &&
          rows.map((p, i) => {
            const isMe = p.id === userId;
            const value = (p[metric] ?? 0) as number;
            const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`;
            return (
              <div
                key={p.id}
                className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 backdrop-blur ${
                  isMe
                    ? "border-primary/50 bg-primary/10"
                    : "border-border bg-card/40"
                }`}
              >
                <div className="w-8 text-center text-sm font-semibold tabular-nums">
                  {medal}
                </div>
                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary text-sm font-semibold">
                  {p.avatar_url ? (
                    <img src={p.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    (p.display_name || "?").slice(0, 1).toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">
                    {p.display_name || "Ohne Namen"} {isMe && <span className="text-[10px] text-primary">· Du</span>}
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    Lv {p.level ?? 1}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-base font-semibold tabular-nums">{value.toLocaleString("de-DE")}</div>
                  <div className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                    {METRIC_LABEL[metric]}
                  </div>
                </div>
              </div>
            );
          })}
      </section>
      <BottomNav />
    </main>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 whitespace-nowrap rounded-full px-3 py-1.5 transition ${
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
