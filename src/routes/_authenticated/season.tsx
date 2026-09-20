import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { ShareCard } from "@/components/ShareCard";

export const Route = createFileRoute("/_authenticated/season")({
  head: () => ({
    meta: [
      { title: "Saison & Belohnungen — Nosy Push-Ups" },
      {
        name: "description",
        content:
          "Sammle Saisonpunkte, steige von Bronze bis Elite auf und tausche Münzen gegen Themes, Rahmen und Streak-Freezes.",
      },
      { property: "og:title", content: "Saison & Belohnungen — Nosy Push-Ups" },
      {
        property: "og:description",
        content: "Liga-Aufstieg von Bronze bis Elite und Belohnungen im Münz-Shop.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SeasonPage,
});

type Season = { id: string; name: string; starts_on: string; ends_on: string };
type Score = { user_id: string; points: number; league: string };
type ShopItem = {
  id: string;
  name: string;
  description: string;
  kind: string;
  icon: string;
  cost: number;
};

const LEAGUES = [
  { id: "bronze", label: "Bronze", icon: "🥉", min: 0 },
  { id: "silver", label: "Silber", icon: "🥈", min: 500 },
  { id: "gold", label: "Gold", icon: "🥇", min: 1500 },
  { id: "elite", label: "Elite", icon: "💎", min: 3000 },
];

function SeasonPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [season, setSeason] = useState<Season | null>(null);
  const [scores, setScores] = useState<Score[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [coins, setCoins] = useState(0);
  const [items, setItems] = useState<ShopItem[]>([]);
  const [owned, setOwned] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setUserId(u.user.id);
    const today = new Date().toISOString().slice(0, 10);

    const [{ data: s }, { data: shop }, { data: prof }, { data: mine }] = await Promise.all([
      supabase
        .from("seasons")
        .select("id, name, starts_on, ends_on")
        .eq("active", true)
        .lte("starts_on", today)
        .gte("ends_on", today)
        .order("starts_on", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("shop_items").select("*").order("sort_order"),
      supabase.from("profiles").select("coins").eq("id", u.user.id).maybeSingle(),
      supabase.from("user_items").select("item_id").eq("user_id", u.user.id),
    ]);

    setSeason((s ?? null) as Season | null);
    setItems((shop ?? []) as ShopItem[]);
    setCoins(((prof as { coins?: number } | null)?.coins ?? 0) as number);
    setOwned((mine ?? []).map((r) => r.item_id as string));

    if (s) {
      const { data: sc } = await supabase
        .from("season_scores")
        .select("user_id, points, league")
        .eq("season_id", s.id)
        .order("points", { ascending: false })
        .limit(50);
      const rows = (sc ?? []) as Score[];
      setScores(rows);
      if (rows.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", rows.map((r) => r.user_id));
        const map: Record<string, string> = {};
        for (const p of profs ?? []) map[p.id as string] = (p.display_name as string) ?? "Athlet";
        setNames(map);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const buy = async (item: ShopItem) => {
    setBusy(item.id);
    setHint(null);
    const { error } = await (
      supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ error: { message: string } | null }>
    )("purchase_shop_item", { _item_id: item.id });
    if (error) {
      setHint(error.message.includes("Münzen") ? "Nicht genug Münzen" : "Kauf nicht möglich");
    } else {
      setHint(`${item.name} freigeschaltet`);
      await load();
    }
    setBusy(null);
  };

  const myScore = scores.find((s) => s.user_id === userId);
  const myPoints = myScore?.points ?? 0;
  const myLeagueIdx = Math.max(
    0,
    LEAGUES.findIndex((l) => l.id === (myScore?.league ?? "bronze")),
  );
  const nextLeague = LEAGUES[myLeagueIdx + 1];
  const myRank = scores.findIndex((s) => s.user_id === userId) + 1;
  const daysLeft = season
    ? Math.max(
        0,
        Math.ceil((new Date(season.ends_on).getTime() - Date.now()) / 86400000),
      )
    : 0;

  return (
    <main className="relative mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pt-6">
      <header className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            {season?.name ?? "Saison"}
          </div>
          <h1 className="mt-0.5 text-xl font-bold tracking-tight">Liga & Belohnungen</h1>
        </div>
        <Link
          to="/"
          className="rounded-full border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground"
        >
          Zurück
        </Link>
      </header>

      {loading && (
        <div className="mt-6 rounded-2xl border border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">
          Lade…
        </div>
      )}

      {!loading && !season && (
        <div className="mt-6 rounded-2xl border border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">
          Gerade läuft keine Saison.
        </div>
      )}

      {!loading && season && (
        <>
          {/* Eigener Stand */}
          <section className="mt-5 rounded-3xl border border-border bg-card/60 p-5 backdrop-blur">
            <div className="flex items-center gap-4">
              <span className="text-5xl">{LEAGUES[myLeagueIdx]?.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="text-lg font-bold">{LEAGUES[myLeagueIdx]?.label}-Liga</div>
                <div className="text-xs text-muted-foreground">
                  {myPoints} Punkte · Platz {myRank > 0 ? myRank : "—"} · noch {daysLeft} Tage
                </div>
              </div>
              <div className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                🪙 {coins}
              </div>
            </div>

            {nextLeague && (
              <>
                <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{
                      width: `${Math.min(100, (myPoints / nextLeague.min) * 100)}%`,
                    }}
                  />
                </div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  Noch {Math.max(0, nextLeague.min - myPoints)} Punkte bis {nextLeague.label}
                </div>
              </>
            )}

            <div className="mt-4">
              <ShareCard
                label="Saison-Stand teilen"
                stats={{
                  title: season.name,
                  headline: `${myPoints} Punkte`,
                  subline: `${LEAGUES[myLeagueIdx]?.label}-Liga`,
                  rows: [
                    { label: "Platz", value: myRank > 0 ? `#${myRank}` : "—" },
                    { label: "Liga", value: LEAGUES[myLeagueIdx]?.label ?? "Bronze" },
                    { label: "Tage übrig", value: `${daysLeft}` },
                  ],
                }}
              />
            </div>
          </section>

          {/* Rangliste */}
          <section className="mt-5">
            <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Saison-Rangliste
            </h2>
            <div className="space-y-2">
              {scores.length === 0 && (
                <div className="rounded-2xl border border-border bg-card/40 p-4 text-center text-sm text-muted-foreground">
                  Noch keine Punkte. Trainiere und eröffne die Saison.
                </div>
              )}
              {scores.map((s, i) => (
                <div
                  key={s.user_id}
                  className={`flex items-center gap-3 rounded-2xl border p-3 ${
                    s.user_id === userId
                      ? "border-primary/40 bg-primary/10"
                      : "border-border bg-card/50"
                  }`}
                >
                  <span className="w-6 text-sm font-bold tabular-nums text-muted-foreground">
                    {i + 1}
                  </span>
                  <span className="text-lg">
                    {LEAGUES.find((l) => l.id === s.league)?.icon ?? "🥉"}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {names[s.user_id] ?? "Athlet"}
                  </span>
                  <span className="text-sm font-semibold tabular-nums">{s.points}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Shop */}
          <section className="mt-6">
            <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Belohnungs-Shop
            </h2>
            {hint && (
              <p className="mb-2 text-center text-xs text-muted-foreground">{hint}</p>
            )}
            <div className="space-y-2">
              {items.map((item) => {
                const has = owned.includes(item.id) && item.kind !== "streak_freeze";
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-card/50 p-3"
                  >
                    <span className="text-2xl">{item.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold">{item.name}</div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {item.description}
                      </div>
                    </div>
                    <button
                      onClick={() => buy(item)}
                      disabled={has || busy === item.id || coins < item.cost}
                      className="shrink-0 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-40"
                    >
                      {has ? "Aktiv" : busy === item.id ? "…" : `🪙 ${item.cost}`}
                    </button>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Münzen bekommst du automatisch für jedes Training.
            </p>
          </section>
        </>
      )}

      <BottomNav />
    </main>
  );
}
