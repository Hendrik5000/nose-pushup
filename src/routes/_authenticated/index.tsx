import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ExerciseMeta } from "@/lib/exercises";
import { levelProgress } from "@/lib/level";
import { AiCoachCard } from "@/components/AiCoachCard";
import { ChallengesPanel } from "@/components/ChallengesPanel";
import { FriendActivity } from "@/components/FriendActivity";
import { WorkoutHistory } from "@/components/WorkoutHistory";
import { BottomNav } from "@/components/BottomNav";
import { getQuickStartPlan } from "@/lib/workout-plans";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Nosy Push-Ups — Dashboard" },
      {
        name: "description",
        content:
          "Zähle Push-Ups mit der Nase, sammle XP, halte deine Streak und tritt gegen Freunde an.",
      },
      { property: "og:title", content: "Nosy Push-Ups — Dashboard" },
      { property: "og:description", content: "Push-Ups zählen, XP sammeln, Streak halten." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  best_count: number;
  personal_bests: Record<string, number>;
  xp: number;
  level: number;
  current_streak: number;
  longest_streak: number;
  last_workout_date: string | null;
  daily_goal: number;
};

type PushMode = "nose" | "manual" | "camera";

const PROFILE_COLS =
  "id, display_name, avatar_url, best_count, personal_bests, xp, level, current_streak, longest_streak, last_workout_date, daily_goal";

function Dashboard() {
  const [exercises, setExercises] = useState<ExerciseMeta[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [todayReps, setTodayReps] = useState(0);
  const [todaySteps, setTodaySteps] = useState(0);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<PushMode>("nose");

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setUserId(u.user.id);
      const today = new Date().toISOString().slice(0, 10);

      const [{ data: ex }, { data: p }, { data: ds }, { data: he }] = await Promise.all([
        supabase.from("exercises").select("*").order("sort_order"),
        supabase.from("profiles").select(PROFILE_COLS).eq("id", u.user.id).maybeSingle(),
        supabase
          .from("daily_stats")
          .select("day, total_reps")
          .eq("user_id", u.user.id)
          .eq("day", today)
          .maybeSingle(),
        supabase
          .from("health_entries")
          .select("steps")
          .eq("user_id", u.user.id)
          .eq("day", today)
          .maybeSingle(),
      ]);

      if (ex) setExercises(ex as ExerciseMeta[]);

      let prof = p;
      if (!prof) {
        // Selbstheilung: Profil anlegen (z. B. für Gast-Konten ohne Zeile).
        const { data: created } = await supabase
          .from("profiles")
          .insert({
            id: u.user.id,
            display_name:
              (u.user.user_metadata?.display_name as string | undefined) ??
              (u.user.is_anonymous ? "Gast" : (u.user.email?.split("@")[0] ?? null)),
          })
          .select(PROFILE_COLS)
          .maybeSingle();
        prof = created;
      }
      if (prof) {
        const raw = prof as unknown as Omit<Profile, "personal_bests"> & {
          personal_bests: Record<string, number> | null;
        };
        setProfile({ ...raw, personal_bests: raw.personal_bests ?? {} });
      }
      if (ds) setTodayReps(ds.total_reps ?? 0);
      if (he) setTodaySteps(he.steps ?? 0);
      setLoading(false);
    })();
  }, []);

  const lp = useMemo(() => levelProgress(profile?.xp ?? 0), [profile?.xp]);
  const initials = (profile?.display_name || "?").slice(0, 1).toUpperCase();
  const streak = profile?.current_streak ?? 0;
  const goal = profile?.daily_goal || 50;
  const goalPct = Math.min(1, todayReps / goal);
  const streakActive = (() => {
    if (!profile?.last_workout_date) return false;
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    return profile.last_workout_date === today || profile.last_workout_date === yesterday;
  })();

  const pushupBest = profile?.personal_bests?.pushup ?? profile?.best_count ?? 0;
  const otherExercises = exercises.filter((e) => e.id !== "pushup");
  const quickStart = getQuickStartPlan({
    best: pushupBest,
    todayReps,
    streak,
    goal,
  });
  const pushupEx = exercises.find((e) => e.id === "pushup");
  const dateLabel = new Date().toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <main className="relative mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pt-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            {dateLabel}
          </div>
          <h1 className="mt-0.5 text-xl font-bold tracking-tight">
            Hallo {profile?.display_name || "Athlet"} 👋
          </h1>
        </div>
        <Link
          to="/profile"
          className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary text-sm font-semibold text-secondary-foreground"
          aria-label="Profil"
        >
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            initials
          )}
        </Link>
      </header>

      {/* Aktivitäts-Ring (Samsung-Health-Struktur) */}
      <section className="mt-5 rounded-3xl border border-border bg-card/60 p-5 backdrop-blur">
        <div className="flex items-center gap-5">
          <ActivityRing pct={goalPct} value={todayReps} goal={goal} />
          <div className="min-w-0 flex-1 space-y-2.5">
            <RingRow icon="🏆" label="Bestwert" value={`${pushupBest}`} />
            <RingRow icon={streakActive && streak > 0 ? "🔥" : "❄️"} label="Streak" value={`${streak} Tage`} />
            <RingRow icon="👟" label="Schritte" value={todaySteps ? todaySteps.toLocaleString("de-DE") : "—"} />
          </div>
        </div>

        <div className="mt-5 border-t border-border pt-4">
          <div className="flex items-baseline justify-between text-xs">
            <span className="font-semibold">
              Level {lp.level} · {lp.title}
            </span>
            <span className="tabular-nums text-muted-foreground">
              {lp.xp.toLocaleString("de-DE")} XP
            </span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${lp.progress * 100}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            <span>
              {lp.xpIntoLevel} / {lp.xpForLevel} XP
            </span>
            <span>{lp.isMax ? "Max" : `Noch ${lp.xpToNext} XP`}</span>
          </div>
        </div>
      </section>

      {/* Quick Tiles */}
      <section className="mt-4 grid grid-cols-3 gap-2">
        <Tile to="/battle" icon="⚔️" label="Battle" />
        <Tile to="/calisthenics" icon="🤸" label="Cali" />
        <Tile to="/health" icon="❤️" label="Health" />
      </section>

      {/* Schnellstart */}
      <section className="mt-8 overflow-hidden rounded-3xl border border-primary/40 bg-gradient-to-br from-primary/15 via-card/70 to-card/60 p-5 backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-primary">Schnellstart</div>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-foreground">{quickStart.headline}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{quickStart.detail}</p>
          </div>
          <div className="rounded-2xl border border-primary/30 bg-background/60 px-3 py-2 text-center">
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Plan</div>
            <div className="text-sm font-semibold text-foreground">{quickStart.sets} × {quickStart.reps}</div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-2xl border border-border/70 bg-background/40 px-3 py-3 text-sm">
          <span className="text-muted-foreground">{quickStart.title}</span>
          <span className="font-semibold text-foreground">Pause {quickStart.rest_s}s</span>
        </div>

        <Link
          to="/workout/$exerciseId"
          params={{ exerciseId: "pushup" }}
          search={{ mode }}
          className="mt-4 flex w-full items-center justify-center rounded-2xl bg-primary px-4 py-4 text-base font-semibold text-primary-foreground transition active:scale-[0.98]"
        >
          Jetzt starten →
        </Link>
      </section>

      {/* Push-Up Hero */}
      <section className="mt-4 overflow-hidden rounded-3xl border border-border bg-card/50 p-5 backdrop-blur">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-primary">Haupt-Übung</div>
            <h2 className="mt-1 text-3xl font-bold tracking-tight text-foreground">Push-Ups</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Nase antippen, manuell eintragen oder von der Kamera zählen lassen.
            </p>
          </div>
          <span className="text-5xl">{pushupEx?.icon ?? "💪"}</span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <ModeChip active={mode === "nose"} onClick={() => setMode("nose")} icon="👃" label="Nase" />
          <ModeChip active={mode === "manual"} onClick={() => setMode("manual")} icon="👆" label="Manuell" />
          <ModeChip active={mode === "camera"} onClick={() => setMode("camera")} icon="📷" label="Kamera" />
        </div>

        <Link
          to="/workout/$exerciseId"
          params={{ exerciseId: "pushup" }}
          search={{ mode }}
          className="mt-4 flex w-full items-center justify-center rounded-2xl bg-primary px-4 py-4 text-base font-semibold text-primary-foreground transition active:scale-[0.98]"
        >
          Workout starten →
        </Link>
      </section>

      {/* Motivation */}
      {userId && (
        <section className="mt-4 rounded-3xl border border-border bg-card/50 p-4 backdrop-blur">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Heute</div>
              <div className="text-sm font-semibold text-foreground">
                {streak > 0 ? `${streak} Tage in Folge` : "Neuer Start heute"}
              </div>
            </div>
            <div className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
              {goal - todayReps > 0 ? `${goal - todayReps} Reps bis zum Ziel` : "Ziel erreicht"}
            </div>
          </div>
        </section>
      )}

      {/* Kurzer Fokusblock */}
      {userId && (
        <section className="mt-3 rounded-2xl border border-border/70 bg-background/40 p-3 text-sm text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>Heute fokus: {goal - todayReps > 0 ? `${goal - todayReps} Reps noch` : "voller Einsatz"}</span>
            <span className="font-semibold text-foreground">{pushupBest} Best</span>
          </div>
        </section>
      )}

      {/* Smart Coach (AI) */}
      <AiCoachCard />

      {/* Weitere Übungen */}
      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Weitere Übungen
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {loading && (
            <div className="col-span-full rounded-2xl border border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">
              Lade…
            </div>
          )}
          {otherExercises.map((ex) => {
            const best = profile?.personal_bests?.[ex.id] ?? 0;
            return (
              <Link
                key={ex.id}
                to="/workout/$exerciseId"
                params={{ exerciseId: ex.id }}
                className="group flex flex-col gap-1 rounded-2xl border border-border bg-card/50 p-4 backdrop-blur transition active:scale-[0.98] hover:border-primary/40"
              >
                <div className="flex items-center justify-between">
                  <span className="text-3xl">{ex.icon}</span>
                  <span className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
                    {ex.detection_type === "touch" && "Touch"}
                    {ex.detection_type === "motion_vertical" && "Sensor"}
                    {ex.detection_type === "timer" && "Timer"}
                    {ex.detection_type === "combo" && "Kombi"}
                  </span>
                </div>
                <div className="mt-1 text-sm font-semibold text-foreground">{ex.name}</div>
                <div className="flex justify-between text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  <span>Best</span>
                  <span className="tabular-nums">
                    {best > 0 ? `${best}${ex.unit === "seconds" ? "s" : ""}` : "—"}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <BottomNav />
    </main>
  );
}

function ActivityRing({ pct, value, goal }: { pct: number; value: number; goal: number }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-32 w-32 shrink-0">
      <svg viewBox="0 0 110 110" className="h-full w-full -rotate-90">
        <circle cx="55" cy="55" r={r} fill="none" stroke="var(--color-secondary)" strokeWidth="10" />
        <circle
          cx="55"
          cy="55"
          r={r}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-3xl font-bold tabular-nums leading-none">{value}</span>
        <span className="mt-1 text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
          / {goal} Reps
        </span>
      </div>
    </div>
  );
}

function RingRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-background/40 px-3 py-2">
      <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <span className="text-base leading-none">{icon}</span>
        {label}
      </span>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function Tile({ to, icon, label }: { to: string; icon: string; label: string }) {
  return (
    <Link
      to={to}
      className="flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-card/50 py-3 text-[10px] font-medium text-muted-foreground backdrop-blur transition active:scale-[0.97] hover:border-primary/40"
    >
      <span className="text-2xl leading-none">{icon}</span>
      {label}
    </Link>
  );
}

function ModeChip({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2 text-xs font-medium transition ${
        active
          ? "border-primary bg-primary/15 text-foreground"
          : "border-border bg-secondary/60 text-muted-foreground hover:text-foreground"
      }`}
    >
      <span className="text-lg leading-none">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
