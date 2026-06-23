import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Nose Push — Push-Up Zähler" },
      { name: "description", content: "Zähle Push-Ups mit der Nase. Bestwerte werden geräteübergreifend gespeichert." },
    ],
  }),
  component: Counter,
});

function formatTime(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m.toString().padStart(2, "0")}:${r.toString().padStart(2, "0")}`;
}

type Profile = { id: string; display_name: string | null; avatar_url: string | null; best_count: number };

function Counter() {
  const [count, setCount] = useState(0);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [pop, setPop] = useState(0);
  const [saving, setSaving] = useState(false);
  const [savedHint, setSavedHint] = useState<string | null>(null);
  const lastTap = useRef(0);
  const audioCtx = useRef<AudioContext | null>(null);

  // Load profile
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, best_count")
        .eq("id", u.user.id)
        .maybeSingle();
      if (!cancelled && data) setProfile(data as Profile);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [startedAt]);

  const beep = useCallback(() => {
    try {
      if (!audioCtx.current) {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtx.current = new Ctx();
      }
      const ctx = audioCtx.current!;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 660;
      o.type = "sine";
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
      o.connect(g).connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.13);
    } catch {
      /* no-op */
    }
  }, []);

  const handlePush = useCallback(() => {
    const t = Date.now();
    if (t - lastTap.current < 280) return;
    lastTap.current = t;
    if (navigator.vibrate) navigator.vibrate(35);
    beep();
    setCount((c) => c + 1);
    setPop((p) => p + 1);
    setStartedAt((s) => s ?? Date.now());
    setSavedHint(null);
  }, [beep]);

  const finishWorkout = async () => {
    if (count <= 0 || !profile) {
      reset();
      return;
    }
    setSaving(true);
    const duration_ms = startedAt ? Date.now() - startedAt : 0;
    const { error } = await supabase.from("workouts").insert({
      user_id: profile.id,
      count,
      duration_ms,
    });
    if (!error && count > profile.best_count) {
      const { data } = await supabase
        .from("profiles")
        .update({ best_count: count })
        .eq("id", profile.id)
        .select("id, display_name, avatar_url, best_count")
        .single();
      if (data) setProfile(data as Profile);
      setSavedHint(`Gespeichert — neuer Bestwert: ${count}`);
    } else if (!error) {
      setSavedHint(`Gespeichert: ${count} Push-Ups`);
    } else {
      setSavedHint("Speichern fehlgeschlagen");
    }
    setSaving(false);
    setCount(0);
    setStartedAt(null);
    setPop(0);
  };

  const reset = () => {
    setCount(0);
    setStartedAt(null);
    setPop(0);
    setSavedHint(null);
  };

  const elapsed = startedAt ? now - startedAt : 0;
  const pace = startedAt && count > 0 ? count / (elapsed / 60000) : 0;
  const best = profile?.best_count ?? 0;
  const initials = (profile?.display_name || "?").slice(0, 1).toUpperCase();

  return (
    <main className="relative flex min-h-[100dvh] flex-col px-5 pt-6 pb-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_12px_var(--color-primary)]" />
          <span className="text-sm font-medium tracking-widest uppercase text-muted-foreground">
            Nose&nbsp;Push
          </span>
        </div>
        <Link
          to="/profile"
          className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary text-sm font-semibold text-secondary-foreground"
          aria-label="Profil"
        >
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            initials
          )}
        </Link>
      </header>

      <section className="mt-6 grid grid-cols-3 gap-3">
        <Stat label="Zeit" value={formatTime(elapsed)} />
        <Stat label="Tempo" value={`${pace ? pace.toFixed(0) : "—"}`} unit="/min" />
        <Stat label="Bestwert" value={best.toString()} />
      </section>

      <button
        onPointerDown={handlePush}
        aria-label="Mit der Nase drücken"
        className="group relative mt-6 flex flex-1 select-none items-center justify-center overflow-hidden rounded-[2rem] border border-border bg-card/60 backdrop-blur active:bg-card transition-colors"
      >
        {count === 0 && (
          <>
            <span className="pointer-events-none absolute h-40 w-40 rounded-full bg-primary/20 animate-pulse-ring" />
            <span className="pointer-events-none absolute h-40 w-40 rounded-full bg-primary/10 animate-pulse-ring [animation-delay:0.7s]" />
          </>
        )}

        <div className="relative flex flex-col items-center gap-3">
          <span className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
            Push-Ups
          </span>
          <span
            key={pop}
            className="font-display text-[9rem] leading-none font-bold tabular-nums text-foreground animate-count-pop"
            style={{ textShadow: "0 0 40px oklch(0.82 0.19 95 / 0.35)" }}
          >
            {count}
          </span>
          <span className="mt-2 max-w-[16rem] text-center text-sm text-muted-foreground">
            {count === 0
              ? "Lege das Handy auf den Boden und tippe es mit der Nase an."
              : "Weiter so — runter, Nase tippen, hoch."}
          </span>
        </div>

        <Corner className="left-3 top-3" />
        <Corner className="right-3 top-3 rotate-90" />
        <Corner className="right-3 bottom-3 rotate-180" />
        <Corner className="left-3 bottom-3 -rotate-90" />
      </button>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          onClick={reset}
          className="rounded-xl border border-border bg-secondary px-4 py-3 text-sm font-medium text-secondary-foreground transition hover:bg-secondary/80 active:scale-[0.98]"
        >
          Verwerfen
        </button>
        <button
          onClick={finishWorkout}
          disabled={saving || count === 0}
          className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition active:scale-[0.98] disabled:opacity-50"
        >
          {saving ? "Speichere…" : "Workout speichern"}
        </button>
      </div>

      <p className="mt-3 text-center text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
        {savedHint ?? "Tippe irgendwo auf die Fläche"}
      </p>
    </main>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card/50 px-3 py-3 backdrop-blur">
      <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-xl font-semibold tabular-nums text-foreground">{value}</span>
        {unit && <span className="text-[10px] text-muted-foreground">{unit}</span>}
      </div>
    </div>
  );
}

function Corner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`pointer-events-none absolute h-5 w-5 border-l-2 border-t-2 border-primary/70 ${className}`}
    />
  );
}
