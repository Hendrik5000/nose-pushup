import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { SportPageIntro, SportSectionLabel } from "@/components/SportPageIntro";
import { Swords, Trophy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/battle-league")({
  head: () => ({
    meta: [
      { title: "Battle-Liga — Nosy Push-Ups" },
      { name: "description", content: "Elo-Rangliste, Rivalen und deine Battle-Bilanz." },
    ],
  }),
  component: BattleLeaguePage,
});

type RatedProfile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  battle_rating: number | null;
  battle_wins: number | null;
  battle_losses: number | null;
};

type BattleRow = {
  id: string;
  host_id: string;
  guest_id: string | null;
  winner_id: string | null;
  is_bot: boolean;
  status: string;
  created_at: string;
};

type Rival = {
  id: string;
  name: string;
  avatar_url: string | null;
  wins: number;
  losses: number;
};

function BattleLeaguePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [leaders, setLeaders] = useState<RatedProfile[]>([]);
  const [battles, setBattles] = useState<BattleRow[]>([]);
  const [names, setNames] = useState<Map<string, { name: string; avatar: string | null }>>(
    new Map(),
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setUserId(u.user.id);

      const [{ data: lb }, { data: bs }] = await Promise.all([
        supabase
          .from("public_profiles" as never)
          .select("id, display_name, avatar_url, battle_rating, battle_wins, battle_losses")
          .order("battle_rating", { ascending: false })
          .limit(50),
        supabase
          .from("battles")
          .select("id, host_id, guest_id, winner_id, is_bot, status, created_at")
          .or(`host_id.eq.${u.user.id},guest_id.eq.${u.user.id}`)
          .eq("status", "finished")
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      setLeaders((lb ?? []) as unknown as RatedProfile[]);
      const myBattles = ((bs ?? []) as BattleRow[]).filter((b) => !b.is_bot && b.guest_id);
      setBattles(myBattles);

      // Gegner-Namen laden
      const opponentIds = [
        ...new Set(myBattles.map((b) => (b.host_id === u.user.id ? b.guest_id! : b.host_id))),
      ];
      if (opponentIds.length) {
        const { data: ps } = await supabase
          .from("public_profiles" as never)
          .select("id, display_name, avatar_url")
          .in("id", opponentIds);
        const map = new Map<string, { name: string; avatar: string | null }>();
        for (const p of (ps ?? []) as unknown as Array<{
          id: string;
          display_name: string | null;
          avatar_url: string | null;
        }>) {
          map.set(p.id, { name: p.display_name ?? "Unbekannt", avatar: p.avatar_url });
        }
        setNames(map);
      }
      setLoading(false);
    })();
  }, []);

  const myRank = useMemo(() => leaders.findIndex((l) => l.id === userId) + 1, [leaders, userId]);
  const me = leaders.find((l) => l.id === userId);

  const rivals = useMemo<Rival[]>(() => {
    if (!userId) return [];
    const map = new Map<string, { wins: number; losses: number }>();
    for (const b of battles) {
      const opp = b.host_id === userId ? b.guest_id! : b.host_id;
      const entry = map.get(opp) ?? { wins: 0, losses: 0 };
      if (b.winner_id === userId) entry.wins++;
      else if (b.winner_id) entry.losses++;
      map.set(opp, entry);
    }
    return [...map.entries()]
      .map(([id, v]) => ({
        id,
        name: names.get(id)?.name ?? "Unbekannt",
        avatar_url: names.get(id)?.avatar ?? null,
        ...v,
      }))
      .sort((a, b) => b.wins + b.losses - (a.wins + a.losses))
      .slice(0, 10);
  }, [battles, names, userId]);

  const last10 = battles.slice(0, 10);

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pt-6 pb-10">
      <header className="classic-only flex items-center justify-between">
        <Link
          to="/battle"
          className="text-xs uppercase tracking-[0.25em] text-muted-foreground hover:text-foreground transition"
        >
          ← Battle
        </Link>
        <span className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
          Battle-Liga
        </span>
        <span className="w-10" />
      </header>

      <div className="sport-only mt-6">
        <SportPageIntro
          eyebrow="Battle-Liga · Elo-Wertung"
          title="Jede Runde zählt."
          description="Verfolge deine Platzierung, analysiere direkte Rivalitäten und arbeite dich in der Arena nach oben."
        >
          <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
            <Trophy className="h-4 w-4" /> {me?.battle_rating ?? 1000} Elo
          </div>
        </SportPageIntro>
      </div>
      <div className="sport-only mt-7">
        <SportSectionLabel number="01">Dein Ranking</SportSectionLabel>
      </div>
      {/* Eigene Platzierung */}
      <section className="mt-6 rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/15 via-card/70 to-card/60 p-5 backdrop-blur">
        <div className="text-[10px] uppercase tracking-[0.25em] text-primary">
          Deine Platzierung
        </div>
        <div className="mt-2 flex items-end justify-between">
          <div>
            <div className="text-4xl font-bold tabular-nums">{myRank > 0 ? `#${myRank}` : "—"}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {me
                ? `${me.battle_wins ?? 0} Siege · ${me.battle_losses ?? 0} Niederlagen`
                : "Noch keine Battles"}
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-semibold tabular-nums text-primary">
              {me?.battle_rating ?? 1000}
            </div>
            <div className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
              Wertung
            </div>
          </div>
        </div>
      </section>

      {leaders.length > 0 && (
        <section className="sport-only mt-7">
          <SportSectionLabel number="02">Podium · Battle-Rating</SportSectionLabel>
          <ol className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {leaders.slice(0, 3).map((p, i) => (
              <li
                key={p.id}
                className={`rounded-2xl border p-4 ${p.id === userId ? "border-primary/50 bg-primary/10" : "border-border bg-card/60"}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                    Platz {i + 1}
                  </span>
                  <Trophy className="h-5 w-5 text-primary" />
                </div>
                <div className="mt-4 truncate text-base font-bold">
                  {p.display_name || "Ohne Namen"}
                  {p.id === userId ? " · Du" : ""}
                </div>
                <div className="mt-1 text-sm tabular-nums text-muted-foreground">
                  {p.battle_rating ?? 1000} Elo
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
      <div className="sport-only mt-7">
        <SportSectionLabel number="03">Volle Rangliste</SportSectionLabel>
      </div>
      {/* Elo-Rangliste */}
      <section className="mt-6">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Rangliste
        </h2>
        {loading ? (
          <p className="rounded-2xl border border-border bg-card/40 p-4 text-center text-sm text-muted-foreground">
            Lade…
          </p>
        ) : (
          <ul className="space-y-2">
            {leaders.slice(0, 20).map((p, i) => {
              const isMe = p.id === userId;
              const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`;
              return (
                <li
                  key={p.id}
                  className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 backdrop-blur ${
                    isMe ? "border-primary/50 bg-primary/10" : "border-border bg-card/40"
                  }`}
                >
                  <div className="w-8 text-center text-sm font-semibold tabular-nums">
                    <span className="classic-only">{medal}</span>
                    <span className="sport-only">
                      {i < 3 ? <Trophy className="mx-auto h-4 w-4 text-primary" /> : i + 1}
                    </span>
                  </div>
                  <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary text-xs font-semibold">
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      (p.display_name || "?").slice(0, 1).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">
                      {p.display_name || "Ohne Namen"}{" "}
                      {isMe && <span className="text-[10px] text-primary">· Du</span>}
                    </div>
                    <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                      {p.battle_wins ?? 0}W / {p.battle_losses ?? 0}L
                    </div>
                  </div>
                  <div className="text-base font-semibold tabular-nums">
                    {p.battle_rating ?? 1000}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {rivals.length > 0 && (
        <div className="sport-only mt-7">
          <SportSectionLabel number="04">Direkte Rivalen</SportSectionLabel>
        </div>
      )}
      {/* Rivalen */}
      {rivals.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Deine Rivalen
          </h2>
          <ul className="space-y-2">
            {rivals.map((r) => {
              const nemesis = r.wins >= 5;
              return (
                <li
                  key={r.id}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card/40 px-3 py-2.5 backdrop-blur"
                >
                  <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary text-xs font-semibold">
                    {r.avatar_url ? (
                      <img src={r.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      r.name.slice(0, 1).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">
                      {r.name} {nemesis && <span title="Nemesis">😈</span>}
                    </div>
                    <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                      {r.wins} Siege · {r.losses} Niederlagen
                    </div>
                  </div>
                  <Link
                    to="/battle"
                    className="rounded-xl border border-primary/40 bg-primary/10 px-3 py-1.5 text-[11px] font-semibold text-primary transition active:scale-[0.98]"
                  >
                    <>
                      <span className="classic-only">Revanche ⚔️</span>
                      <span className="sport-only flex items-center gap-1">
                        Revanche <Swords className="h-3.5 w-3.5" />
                      </span>
                    </>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {last10.length > 0 && (
        <div className="sport-only mt-7">
          <SportSectionLabel number="05">Formkurve</SportSectionLabel>
        </div>
      )}
      {/* Verlauf letzte 10 Kämpfe */}
      {last10.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Letzte {last10.length} Kämpfe
          </h2>
          <div className="flex gap-1.5">
            {last10.map((b) => {
              const won = b.winner_id === userId;
              return (
                <div
                  key={b.id}
                  title={new Date(b.created_at).toLocaleDateString("de-DE")}
                  className={`flex h-9 flex-1 items-center justify-center rounded-lg text-xs font-bold ${
                    won ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                  }`}
                >
                  {won ? "S" : "N"}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <BottomNav />
    </main>
  );
}
