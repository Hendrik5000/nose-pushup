import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { createClub, joinClubByCode } from "@/lib/club.functions";

export const Route = createFileRoute("/_authenticated/clubs")({
  head: () => ({
    meta: [
      { title: "Clubs — Nosy Push-Ups" },
      {
        name: "description",
        content: "Gründe einen Club, erreicht gemeinsam das Wochenziel und klettert in der Club-Liga nach oben.",
      },
      { property: "og:title", content: "Clubs — Nosy Push-Ups" },
      { property: "og:description", content: "Gemeinsames Wochenziel, Club-Feed und Liga-Rangliste." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClubsPage,
});

type Club = {
  id: string;
  name: string;
  motto: string;
  color: string;
  code: string;
  owner_id: string;
  weekly_goal: number;
};
type MemberStat = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  reps: number;
  level: number | null;
};
type LeagueRow = {
  club_id: string;
  name: string;
  color: string;
  members: number;
  week_reps: number;
  weekly_goal: number;
};
type Post = {
  id: string;
  user_id: string;
  kind: string;
  body: string;
  created_at: string;
};

const TIERS = [
  { min: 5000, label: "Elite", icon: "💎" },
  { min: 2500, label: "Gold", icon: "🥇" },
  { min: 1000, label: "Silber", icon: "🥈" },
  { min: 0, label: "Bronze", icon: "🥉" },
];

function tierFor(reps: number) {
  return TIERS.find((t) => reps >= t.min) ?? TIERS[TIERS.length - 1];
}

function ClubsPage() {
  const create = useServerFn(createClub);
  const join = useServerFn(joinClubByCode);

  const [userId, setUserId] = useState<string | null>(null);
  const [club, setClub] = useState<Club | null>(null);
  const [members, setMembers] = useState<MemberStat[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [league, setLeague] = useState<LeagueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<null | "create" | "join" | "post" | "leave">(null);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [motto, setMotto] = useState("");
  const [goal, setGoal] = useState(1000);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id ?? null;
    setUserId(uid);
    if (!uid) {
      setLoading(false);
      return;
    }
    const { data: mem } = await supabase
      .from("club_members" as never)
      .select("club_id")
      .eq("user_id", uid)
      .limit(1);
    const clubId = ((mem ?? []) as unknown as Array<{ club_id: string }>)[0]?.club_id ?? null;

    const { data: leagueRows } = await supabase.rpc("club_league" as never);
    setLeague((leagueRows ?? []) as unknown as LeagueRow[]);

    if (!clubId) {
      setClub(null);
      setMembers([]);
      setPosts([]);
      setLoading(false);
      return;
    }

    const [{ data: c }, { data: stats }, { data: feed }] = await Promise.all([
      supabase.from("clubs" as never).select("*").eq("id", clubId).maybeSingle(),
      supabase.rpc("club_week_stats" as never, { _club_id: clubId } as never),
      supabase
        .from("club_posts" as never)
        .select("id, user_id, kind, body, created_at")
        .eq("club_id", clubId)
        .order("created_at", { ascending: false })
        .limit(25),
    ]);
    setClub((c as unknown as Club) ?? null);
    setMembers((stats ?? []) as unknown as MemberStat[]);
    setPosts((feed ?? []) as unknown as Post[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async () => {
    setBusy("create");
    setError(null);
    try {
      await create({ data: { name, motto, weekly_goal: goal } });
      setName("");
      setMotto("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(null);
    }
  };

  const handleJoin = async () => {
    setBusy("join");
    setError(null);
    try {
      await join({ data: { code } });
      setCode("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Club nicht gefunden");
    } finally {
      setBusy(null);
    }
  };

  const handlePost = async () => {
    if (!club || !userId || !message.trim()) return;
    setBusy("post");
    const body = message.trim().slice(0, 280);
    const { error: e } = await supabase
      .from("club_posts" as never)
      .insert({ club_id: club.id, user_id: userId, kind: "text", body } as never);
    if (e) setError(e.message);
    else {
      setMessage("");
      await load();
    }
    setBusy(null);
  };

  const handleLeave = async () => {
    if (!club || !userId) return;
    setBusy("leave");
    await supabase.from("club_members" as never).delete().eq("club_id", club.id).eq("user_id", userId);
    await load();
    setBusy(null);
  };

  const totalReps = members.reduce((sum, m) => sum + (m.reps ?? 0), 0);
  const goalPct = club ? Math.min(100, Math.round((totalReps / Math.max(1, club.weekly_goal)) * 100)) : 0;
  const tier = tierFor(totalReps);

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pt-6">
      <header className="flex items-center justify-between">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Zurück
        </Link>
        <span className="text-sm font-medium">🛡️ Clubs</span>
      </header>

      {loading ? (
        <p className="mt-10 text-center text-sm text-muted-foreground">Lade Clubs…</p>
      ) : club ? (
        <>
          <section
            className="mt-6 rounded-3xl border p-5 backdrop-blur"
            style={{ borderColor: `${club.color}66`, background: `linear-gradient(140deg, ${club.color}22, transparent)` }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{club.name}</h1>
                {club.motto && <p className="mt-1 text-sm text-muted-foreground">{club.motto}</p>}
              </div>
              <div className="text-right">
                <div className="text-2xl">{tier.icon}</div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{tier.label}</div>
              </div>
            </div>

            <div className="mt-5">
              <div className="flex items-end justify-between text-sm">
                <span className="text-muted-foreground">Wochenziel</span>
                <span className="font-semibold tabular-nums">
                  {totalReps} / {club.weekly_goal}
                </span>
              </div>
              <div className="mt-2 h-3 overflow-hidden rounded-full border border-border bg-secondary">
                <div
                  className="h-full transition-all"
                  style={{ width: `${goalPct}%`, background: club.color }}
                />
              </div>
              {goalPct >= 100 && (
                <p className="mt-2 text-xs font-semibold text-primary">🎉 Wochenziel erreicht!</p>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              <span>Einladungscode</span>
              <span className="font-mono text-sm tracking-[0.3em] text-foreground">{club.code}</span>
            </div>
          </section>

          <section className="mt-6">
            <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Mitglieder diese Woche
            </h2>
            <ul className="space-y-2">
              {members.map((m, i) => (
                <li
                  key={m.user_id}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card/50 px-4 py-3"
                >
                  <span className="w-5 text-sm font-semibold tabular-nums text-muted-foreground">{i + 1}</span>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{m.display_name ?? "Athlet"}</div>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      Level {m.level ?? 1}
                    </div>
                  </div>
                  <span className="text-lg font-semibold tabular-nums text-primary">{m.reps}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-6">
            <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Club-Feed
            </h2>
            <div className="flex gap-2">
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Kurzer Post an den Club…"
                maxLength={280}
                className="flex-1 rounded-xl border border-border bg-background/60 px-4 py-3 text-sm focus:border-primary focus:outline-none"
              />
              <button
                onClick={handlePost}
                disabled={busy !== null || !message.trim()}
                className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                Senden
              </button>
            </div>
            <ul className="mt-3 space-y-2">
              {posts.map((p) => (
                <li key={p.id} className="rounded-2xl border border-border bg-card/50 px-4 py-3">
                  <div className="text-sm">{p.body}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    {new Date(p.created_at).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}
                  </div>
                </li>
              ))}
              {posts.length === 0 && (
                <li className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
                  Noch keine Beiträge — schreib den ersten!
                </li>
              )}
            </ul>
          </section>

          <button
            onClick={handleLeave}
            disabled={busy !== null}
            className="mt-6 w-full rounded-2xl border border-border bg-secondary/60 px-4 py-3 text-sm font-medium text-muted-foreground disabled:opacity-50"
          >
            Club verlassen
          </button>
        </>
      ) : (
        <>
          <section className="mt-6 rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/15 to-card/60 p-5 backdrop-blur">
            <h1 className="text-2xl font-bold tracking-tight">Club gründen</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Bis zu 30 Mitglieder trainieren auf ein gemeinsames Wochenziel.
            </p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Clubname"
              maxLength={40}
              className="mt-4 w-full rounded-xl border border-border bg-background/60 px-4 py-3 text-sm focus:border-primary focus:outline-none"
            />
            <input
              value={motto}
              onChange={(e) => setMotto(e.target.value)}
              placeholder="Motto (optional)"
              maxLength={120}
              className="mt-2 w-full rounded-xl border border-border bg-background/60 px-4 py-3 text-sm focus:border-primary focus:outline-none"
            />
            <div className="mt-3 flex gap-2">
              {[500, 1000, 2500, 5000].map((g) => (
                <button
                  key={g}
                  onClick={() => setGoal(g)}
                  className={`flex-1 rounded-xl border px-2 py-2 text-xs font-semibold transition ${
                    goal === g
                      ? "border-primary bg-primary/20 text-foreground"
                      : "border-border bg-secondary/60 text-muted-foreground"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
            <button
              onClick={handleCreate}
              disabled={busy !== null || name.trim().length < 2}
              className="mt-4 w-full rounded-2xl bg-primary px-4 py-4 text-base font-semibold text-primary-foreground disabled:opacity-50"
            >
              {busy === "create" ? "Erstelle…" : "Club gründen"}
            </button>
          </section>

          <section className="mt-6 rounded-3xl border border-border bg-card/60 p-5 backdrop-blur">
            <h2 className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Club beitreten
            </h2>
            <div className="mt-3 flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="CODE"
                maxLength={8}
                className="flex-1 rounded-xl border border-border bg-background/60 px-4 py-3 text-center font-mono text-lg uppercase tracking-[0.4em] focus:border-primary focus:outline-none"
              />
              <button
                onClick={handleJoin}
                disabled={busy !== null || code.length < 4}
                className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                Join
              </button>
            </div>
          </section>
        </>
      )}

      {error && (
        <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          {error}
        </div>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Club-Liga (diese Woche)
        </h2>
        <ul className="space-y-2">
          {league.map((row, i) => (
            <li
              key={row.club_id}
              className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${
                club?.id === row.club_id ? "border-primary/50 bg-primary/10" : "border-border bg-card/50"
              }`}
            >
              <span className="w-5 text-sm font-semibold tabular-nums text-muted-foreground">{i + 1}</span>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: row.color }} />
              <div className="flex-1">
                <div className="text-sm font-medium">{row.name}</div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  {row.members} Mitglieder · {tierFor(row.week_reps).label}
                </div>
              </div>
              <span className="text-lg font-semibold tabular-nums text-primary">{row.week_reps}</span>
            </li>
          ))}
          {league.length === 0 && (
            <li className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
              Noch keine Clubs — sei der erste!
            </li>
          )}
        </ul>
      </section>

      <BottomNav />
    </main>
  );
}
