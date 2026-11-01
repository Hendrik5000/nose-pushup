import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AloHomeLink } from "@/components/AloHomeLink";
import { BattleFriendInvitationPanel } from "@/components/BattleFriendInvitationPanel";
import { SportPageIntro, SportSectionLabel } from "@/components/SportPageIntro";
import { Bot, Crosshair, Swords, Trophy } from "lucide-react";
import {
  createBattle,
  joinBattle,
  findMatch,
  leaveQueue,
  modeDefaults,
  type BattleMode,
} from "@/lib/battle.functions";

export const Route = createFileRoute("/_authenticated/battle/")({
  head: () => ({
    meta: [
      { title: "Wettkampf — Alo" },
      { name: "description", content: "1v1 Push-Up Duell in Echtzeit — fordere Freunde heraus." },
    ],
  }),
  component: BattleLobby,
});

type BattleRow = {
  id: string;
  code: string;
  status: string;
  host_count: number;
  guest_count: number;
  is_bot: boolean;
  duration_s: number;
  winner_id: string | null;
  created_at: string;
};

function BattleLobby() {
  const navigate = useNavigate();
  const create = useServerFn(createBattle);
  const join = useServerFn(joinBattle);
  const match = useServerFn(findMatch);
  const dequeue = useServerFn(leaveQueue);

  const [code, setCode] = useState("");
  const [duration, setDuration] = useState(60);
  const [busy, setBusy] = useState<null | "create" | "bot" | "join" | "match">(null);
  const [mode, setMode] = useState<BattleMode>("timed");
  const [searching, setSearching] = useState(false);
  const [rating, setRating] = useState(1000);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<BattleRow[]>([]);
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const [{ data: rows }, { data: p }] = await Promise.all([
        supabase
          .from("battles")
          .select(
            "id, code, status, host_count, guest_count, is_bot, duration_s, winner_id, created_at",
          )
          .or(`host_id.eq.${u.user.id},guest_id.eq.${u.user.id}`)
          .in("status", ["finished", "active"])
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("profiles")
          .select("battle_wins, battle_losses, battle_rating")
          .eq("id", u.user.id)
          .maybeSingle(),
      ]);
      if (rows) setHistory(rows as BattleRow[]);
      if (p) {
        setWins((p as { battle_wins: number }).battle_wins ?? 0);
        setLosses((p as { battle_losses: number }).battle_losses ?? 0);
        setRating((p as { battle_rating?: number }).battle_rating ?? 1000);
      }
    })();
  }, []);

  const handleCreate = async (bot = false) => {
    setBusy(bot ? "bot" : "create");
    setError(null);
    try {
      const defaults = modeDefaults(mode);
      const res = await create({
        data: {
          duration_s: mode === "timed" ? duration : defaults.duration_s,
          is_bot: bot,
          mode,
          target_reps: defaults.target_reps,
        },
      });
      navigate({ to: "/battle/$id", params: { id: res.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
      setBusy(null);
    }
  };

  // Zufalls-Matchmaking: pollt die Warteschlange, bis ein Gegner gefunden ist.
  useEffect(() => {
    if (!searching) return;
    let stop = false;
    const tick = async () => {
      if (stop) return;
      try {
        const res = await match({
          data: { mode, duration_s: mode === "timed" ? duration : modeDefaults(mode).duration_s },
        });
        if (res.matched && res.id) {
          setSearching(false);
          navigate({ to: "/battle/$id", params: { id: res.id } });
          return;
        }
        const { data: u } = await supabase.auth.getUser();
        if (u.user) {
          const { data: q } = await supabase
            .from("battle_queue" as never)
            .select("battle_id")
            .eq("user_id", u.user.id)
            .maybeSingle();
          const bid = (q as unknown as { battle_id: string | null } | null)?.battle_id;
          if (bid) {
            setSearching(false);
            navigate({ to: "/battle/$id", params: { id: bid } });
          }
        }
      } catch {
        /* weiter versuchen */
      }
    };
    void tick();
    const t = setInterval(() => void tick(), 3000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [searching, mode, duration, match, navigate]);

  const handleMatchmaking = async () => {
    if (searching) {
      setSearching(false);
      await dequeue({});
      return;
    }
    setError(null);
    setSearching(true);
  };

  const handleJoin = async () => {
    setBusy("join");
    setError(null);
    try {
      const res = await join({ data: { code } });
      navigate({ to: "/battle/$id", params: { id: res.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
      setBusy(null);
    }
  };

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pt-6 pb-10">
      <header className="classic-only flex items-center justify-between">
        <AloHomeLink className="px-2 text-xs" />
        <span className="text-sm font-medium">⚔️ Battle</span>
        <Link
          to="/battle-league"
          className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-primary transition active:scale-[0.98]"
        >
          Liga 🏆
        </Link>
      </header>

      <header className="sport-only mb-5 flex items-center justify-between">
        <AloHomeLink className="px-2 text-xs" />
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em]">
          <Swords className="h-4 w-4 text-primary" /> Arena
        </span>
        <Link
          to="/battle-league"
          className="flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary"
        >
          <Trophy className="h-3.5 w-3.5" /> Liga
        </Link>
      </header>
      <SportPageIntro
        eyebrow="Wettkampf · 1 gegen 1"
        title="Push-Up Duell"
        description="Wähle dein Format, fordere einen Gegner heraus oder trainiere gegen einen Bot."
      >
        <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
          <Swords className="h-4 w-4" /> Battle-Rating {rating}
        </div>
      </SportPageIntro>

      <div className="sport-only mt-7">
        <SportSectionLabel number="01">Wettkampfmodus</SportSectionLabel>
      </div>
      <section className="mt-6 rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/15 via-card/70 to-card/60 p-5 backdrop-blur">
        <div className="text-[10px] uppercase tracking-[0.25em] text-primary">Live 1v1</div>
        <h1 className="classic-only mt-1 text-3xl font-bold tracking-tight">Push-Up Duell</h1>
        <p className="classic-only mt-1 text-sm text-muted-foreground">
          Erstelle ein Battle und teile den Code — oder trete gegen einen Bot an.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {(
            [
              { id: "timed", label: "Zeitduell", hint: "Meiste Reps" },
              { id: "first_to", label: "Erster auf 30", hint: "Tempo zählt" },
              { id: "sprint", label: "60s Sprint", hint: "Vollgas" },
              { id: "endurance", label: "Ausdauer 5 Min", hint: "Durchhalten" },
            ] as Array<{ id: BattleMode; label: string; hint: string }>
          ).map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`rounded-2xl border px-3 py-3 text-left transition ${
                mode === m.id ? "border-primary bg-primary/20" : "border-border bg-secondary/60"
              }`}
            >
              <div className="text-sm font-semibold">{m.label}</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                {m.hint}
              </div>
            </button>
          ))}
        </div>

        {mode === "timed" && (
          <div className="mt-4 flex gap-2">
            {[30, 60, 120].map((d) => (
              <button
                key={d}
                onClick={() => setDuration(d)}
                className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                  duration === d
                    ? "border-primary bg-primary/20 text-foreground"
                    : "border-border bg-secondary/60 text-muted-foreground"
                }`}
              >
                {d}s
              </button>
            ))}
          </div>
        )}

        <button
          onClick={handleMatchmaking}
          disabled={busy !== null}
          className="mt-4 flex w-full items-center justify-center rounded-2xl bg-primary px-4 py-4 text-base font-semibold text-primary-foreground transition active:scale-[0.98] disabled:opacity-50"
        >
          {searching ? (
            "Suche Gegner… (abbrechen)"
          ) : (
            <>
              <span className="classic-only">🎯 </span>
              <Crosshair className="sport-only mr-2 inline h-4 w-4" /> Gegner suchen
            </>
          )}
        </button>
        <button
          onClick={() => handleCreate(false)}
          disabled={busy !== null}
          className="mt-2 flex w-full items-center justify-center rounded-2xl border border-primary/50 bg-primary/15 px-4 py-3 text-sm font-semibold text-foreground transition active:scale-[0.98] disabled:opacity-50"
        >
          {busy === "create" ? "Erstelle…" : "Battle mit Code erstellen"}
        </button>
        <button
          onClick={() => handleCreate(true)}
          disabled={busy !== null}
          className="mt-2 flex w-full items-center justify-center rounded-2xl border border-border bg-secondary/60 px-4 py-3 text-sm font-semibold text-foreground transition active:scale-[0.98] disabled:opacity-50"
        >
          {busy === "bot" ? (
            "…"
          ) : (
            <>
              <span className="classic-only">🤖 </span>
              <Bot className="sport-only mr-2 inline h-4 w-4" /> Gegen Bot antreten
            </>
          )}
        </button>
      </section>

      <BattleFriendInvitationPanel
        mode={mode}
        durationS={mode === "timed" ? duration : modeDefaults(mode).duration_s}
        targetReps={modeDefaults(mode).target_reps}
        onOpenBattle={(battleId) => navigate({ to: "/battle/$id", params: { id: battleId } })}
      />

      <div className="sport-only mt-7">
        <SportSectionLabel number="02">Direkte Herausforderung</SportSectionLabel>
      </div>
      <section className="mt-6 rounded-3xl border border-border bg-card/60 p-5 backdrop-blur">
        <h2 className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Battle beitreten
        </h2>
        <div className="battle-join-row mt-3 flex min-w-0 gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="CODE"
            maxLength={8}
            className="min-w-0 flex-1 rounded-xl border border-border bg-background/60 px-4 py-3 text-center font-mono text-lg tracking-[0.4em] uppercase text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
          />
          <button
            onClick={handleJoin}
            disabled={busy !== null || code.length < 4}
            className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition active:scale-[0.98] disabled:opacity-50"
          >
            {busy === "join" ? "…" : "Join"}
          </button>
        </div>
        {error && (
          <div className="mt-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
            {error}
          </div>
        )}
      </section>

      <div className="sport-only mt-7">
        <SportSectionLabel number="03">Deine Bilanz</SportSectionLabel>
      </div>
      <section className="mt-6 grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-border bg-card/50 px-4 py-3 backdrop-blur">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Wins</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-primary">{wins}</div>
        </div>
        <div className="rounded-2xl border border-border bg-card/50 px-4 py-3 backdrop-blur">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Losses</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-muted-foreground">
            {losses}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card/50 px-4 py-3 backdrop-blur">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Wertung
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{rating}</div>
        </div>
      </section>

      {history.length > 0 && (
        <>
          <div className="sport-only mt-7">
            <SportSectionLabel number="04">Zuletzt im Ring</SportSectionLabel>
          </div>
          <section className="mt-6">
            <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Letzte Battles
            </h2>
            <ul className="space-y-2">
              {history.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center justify-between rounded-2xl border border-border bg-card/50 px-4 py-3"
                >
                  <div>
                    <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                      {b.code}{" "}
                      {b.is_bot && (
                        <>
                          <span className="classic-only">· 🤖</span>
                          <span className="sport-only">· BOT</span>
                        </>
                      )}
                    </div>
                    <div className="text-sm font-semibold tabular-nums">
                      {b.host_count} : {b.guest_count}
                    </div>
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    {b.status === "finished" ? "Beendet" : "Läuft"}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
