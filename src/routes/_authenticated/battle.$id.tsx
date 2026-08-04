import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { finishBattle, startBattle } from "@/lib/battle.functions";
import { feedbackRep, feedbackWin, feedbackLose, feedbackSuccess } from "@/lib/feedback";


export const Route = createFileRoute("/_authenticated/battle/$id")({
  head: () => ({
    meta: [{ title: "Battle Arena — Nosy Push-Ups" }],
  }),
  component: BattleArena,
});

type Battle = {
  id: string;
  code: string;
  host_id: string;
  guest_id: string | null;
  status: "waiting" | "active" | "finished" | "cancelled";
  duration_s: number;
  started_at: string | null;
  ends_at: string | null;
  host_count: number;
  guest_count: number;
  winner_id: string | null;
  is_bot: boolean;
};

function BattleArena() {
  const { id } = useParams({ from: "/_authenticated/battle/$id" });
  const navigate = useNavigate();
  const start = useServerFn(startBattle);
  const finish = useServerFn(finishBattle);

  const [userId, setUserId] = useState<string | null>(null);
  const [battle, setBattle] = useState<Battle | null>(null);
  const [myCount, setMyCount] = useState(0);
  const [oppCount, setOppCount] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [countdown, setCountdown] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);

  const myCountRef = useRef(0);
  const oppCountRef = useRef(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const finishedRef = useRef(false);
  const botTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const iAmHost = battle && userId === battle.host_id;
  const iAmGuest = battle && userId === battle.guest_id;

  // Load user + battle
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (u.user) setUserId(u.user.id);
      const { data: b } = await supabase.from("battles").select("*").eq("id", id).maybeSingle();
      if (b) {
        const row = b as Battle;
        setBattle(row);
        setMyCount(0);
        setOppCount(0);
        myCountRef.current = 0;
        oppCountRef.current = 0;
      }
    })();
  }, [id]);

  // Realtime: battle row + rep broadcast
  useEffect(() => {
    if (!userId || !battle) return;
    const ch = supabase
      .channel(`battle:${id}`, { config: { broadcast: { self: false } } })
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "battles", filter: `id=eq.${id}` },
        (payload) => {
          const next = payload.new as Battle;
          setBattle(next);
        },
      )
      .on("broadcast", { event: "rep" }, (payload) => {
        const p = payload.payload as { user_id: string; count: number };
        if (p.user_id !== userId) {
          oppCountRef.current = Math.max(oppCountRef.current, p.count);
          setOppCount(oppCountRef.current);
        }
      })
      .subscribe();
    channelRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
  }, [id, userId, battle?.id]);

  // Timer
  useEffect(() => {
    if (battle?.status !== "active") return;
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [battle?.status]);

  // 3-2-1 countdown right after status flips to active
  useEffect(() => {
    if (battle?.status !== "active") return;
    setCountdown(3);
    const seq = [3, 2, 1, 0];
    let i = 0;
    const t = setInterval(() => {
      i++;
      if (i >= seq.length) {
        clearInterval(t);
        setCountdown(null);
        return;
      }
      setCountdown(seq[i]);
    }, 800);
    return () => clearInterval(t);
  }, [battle?.status]);

  // Bot loop: simulate opponent reps based on realistic rate
  useEffect(() => {
    if (!battle || !battle.is_bot || battle.status !== "active" || !iAmHost) return;
    if (countdown !== null) return;
    // ~30-45 reps per minute → interval 1300-2000ms
    const step = () => {
      oppCountRef.current += 1;
      setOppCount(oppCountRef.current);
    };
    const spawn = () => {
      const ms = 1200 + Math.random() * 900;
      botTimerRef.current = setTimeout(() => {
        step();
        spawn();
      }, ms) as unknown as ReturnType<typeof setInterval>;
    };
    spawn();
    return () => {
      if (botTimerRef.current) clearTimeout(botTimerRef.current);
      botTimerRef.current = null;
    };
  }, [battle?.is_bot, battle?.status, iAmHost, countdown, battle]);

  const remaining = battle?.ends_at ? Math.max(0, +new Date(battle.ends_at) - now) : battle?.duration_s
    ? battle.duration_s * 1000
    : 0;

  // Auto-finish when time up
  useEffect(() => {
    if (!battle || battle.status !== "active" || finishedRef.current) return;
    if (remaining > 0) return;
    finishedRef.current = true;
    setFinishing(true);
    const payload = battle.is_bot
      ? { id: battle.id, guest_count: oppCountRef.current }
      : { id: battle.id };
    finish({ data: payload })
      .catch(() => undefined)
      .finally(() => setFinishing(false));
  }, [remaining, battle, iAmHost, finish]);

  const tap = useCallback(() => {
    if (!battle || battle.status !== "active" || countdown !== null) return;
    if (!userId || !(iAmHost || iAmGuest)) return;
    myCountRef.current += 1;
    const next = myCountRef.current;
    setMyCount(next);
    feedbackRep(next);
    // Persist to server-side ledger — finishBattle sums these authoritatively.
    void supabase.from("battle_reps").insert({ battle_id: battle.id, user_id: userId, count: 1 });
    channelRef.current?.send({
      type: "broadcast",
      event: "rep",
      payload: { user_id: userId, count: next },
    });
  }, [battle, countdown, userId, iAmHost, iAmGuest]);

  // Ergebnis-Sound genau einmal, sobald das Battle beendet ist.
  const resultPlayed = useRef(false);
  useEffect(() => {
    if (!battle || battle.status !== "finished" || resultPlayed.current) return;
    resultPlayed.current = true;
    if (battle.winner_id && battle.winner_id === userId) feedbackWin();
    else if (battle.winner_id) feedbackLose();
    else feedbackSuccess();
  }, [battle, userId]);



  const doStart = async () => {
    setError(null);
    try {
      await start({ data: { id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    }
  };

  if (!battle) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center text-sm text-muted-foreground">
        Lade Battle…
      </main>
    );
  }

  const seconds = Math.ceil(remaining / 1000);
  const opponentReady = battle.is_bot || !!battle.guest_id;
  const meIsHostOrGuest = iAmHost || iAmGuest;

  // WAITING screen
  if (battle.status === "waiting") {
    const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/battle` : "";
    return (
      <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pt-6 pb-10">
        <header className="flex items-center justify-between">
          <Link to="/battle" className="text-sm text-muted-foreground">← Lobby</Link>
          <span className="text-sm font-medium">⚔️ Warteraum</span>
        </header>
        <section className="mt-8 rounded-3xl border border-primary/40 bg-gradient-to-br from-primary/15 to-card/60 p-6 text-center backdrop-blur">
          <div className="text-[10px] uppercase tracking-[0.25em] text-primary">Battle Code</div>
          <div className="mt-3 flex justify-center">
            <span className="inline-block pl-[0.35em] font-mono text-6xl font-bold tracking-[0.35em] tabular-nums">
              {battle.code}
            </span>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            {battle.is_bot
              ? "Bot bereit. Du kannst jederzeit starten."
              : opponentReady
                ? "Gegner ist da! 🎯"
                : "Teile den Code mit einem Freund oder öffne die Lobby auf einem zweiten Gerät."}
          </p>
          <div className="mt-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {shareUrl}
          </div>

          {iAmHost && (
            <button
              onClick={doStart}
              disabled={!opponentReady}
              className="mt-6 w-full rounded-2xl bg-primary px-4 py-4 text-base font-semibold text-primary-foreground transition active:scale-[0.98] disabled:opacity-40"
            >
              {opponentReady ? "Battle starten" : "Warte auf Gegner…"}
            </button>
          )}
          {!iAmHost && (
            <div className="mt-6 text-sm text-muted-foreground">Warten auf Host…</div>
          )}
          {error && (
            <div className="mt-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              {error}
            </div>
          )}
        </section>
      </main>
    );
  }

  // FINISHED screen
  if (battle.status === "finished") {
    const iWon = battle.winner_id && battle.winner_id === userId;
    const draw = !battle.winner_id;
    const myFinal = iAmHost ? battle.host_count : battle.guest_count;
    const oppFinal = iAmHost ? battle.guest_count : battle.host_count;
    return (
      <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col items-center px-5 pt-8 pb-10">
        <div className="text-6xl">{draw ? "🤝" : iWon ? "🏆" : "💀"}</div>
        <h1 className="mt-4 text-3xl font-bold">
          {draw ? "Unentschieden!" : iWon ? "Sieg!" : "Niederlage"}
        </h1>
        <div className="mt-8 grid w-full grid-cols-2 gap-3">
          <div className="rounded-2xl border border-primary/40 bg-primary/10 p-4 text-center">
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Du</div>
            <div className="mt-1 text-4xl font-bold tabular-nums text-primary">{myFinal}</div>
          </div>
          <div className="rounded-2xl border border-border bg-card/60 p-4 text-center">
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {battle.is_bot ? "Bot" : "Gegner"}
            </div>
            <div className="mt-1 text-4xl font-bold tabular-nums">{oppFinal}</div>
          </div>
        </div>
        <Link
          to="/battle"
          className="mt-8 w-full rounded-2xl bg-primary px-4 py-4 text-center text-base font-semibold text-primary-foreground"
        >
          Neues Battle
        </Link>
        <button
          onClick={() => navigate({ to: "/" })}
          className="mt-2 w-full rounded-2xl border border-border bg-secondary/60 px-4 py-3 text-sm font-medium"
        >
          Zum Dashboard
        </button>
      </main>
    );
  }

  // ACTIVE screen
  const meLabel = iAmHost ? "Du (Host)" : "Du (Gast)";
  const oppLabel = battle.is_bot ? "🤖 Bot" : iAmHost ? "Gast" : "Host";
  const total = Math.max(myCount + oppCount, 1);
  const myPct = (myCount / total) * 100;

  return (
    <main
      className="relative mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pt-6 pb-4"
      onPointerDown={tap}
    >
      <header className="flex items-center justify-between">
        <span className="text-sm font-medium">⚔️ Battle</span>
        <div className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-sm font-semibold tabular-nums text-primary">
          {seconds}s
        </div>
      </header>

      <section className="mt-6 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-primary/40 bg-primary/10 p-4 text-center">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{meLabel}</div>
          <div className="mt-1 text-5xl font-bold tabular-nums text-primary">{myCount}</div>
        </div>
        <div className="rounded-2xl border border-border bg-card/60 p-4 text-center">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{oppLabel}</div>
          <div className="mt-1 text-5xl font-bold tabular-nums">{oppCount}</div>
        </div>
      </section>

      <div className="mt-3 h-3 w-full overflow-hidden rounded-full border border-border bg-secondary">
        <div className="h-full bg-primary transition-all" style={{ width: `${myPct}%` }} />
      </div>

      <div className="mt-6 flex flex-1 select-none items-center justify-center rounded-[2rem] border border-border bg-card/50 backdrop-blur">
        {countdown !== null ? (
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Los in</div>
            <div className="mt-2 text-8xl font-bold tabular-nums text-primary">
              {countdown === 0 ? "GO!" : countdown}
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Tippe mit der Nase</div>
            <div className="mt-2 font-display text-[8rem] leading-none font-bold tabular-nums">
              {myCount}
            </div>
            {finishing && (
              <div className="mt-2 text-xs text-muted-foreground">Werte Ergebnis aus…</div>
            )}
          </div>
        )}
      </div>

      {!meIsHostOrGuest && (
        <div className="mt-3 text-center text-xs text-muted-foreground">
          Du bist Zuschauer — nur Teilnehmer können zählen.
        </div>
      )}
    </main>
  );
}
