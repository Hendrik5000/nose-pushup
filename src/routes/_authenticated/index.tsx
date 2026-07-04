import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ExerciseMeta } from "@/lib/exercises";
import { levelProgress } from "@/lib/level";
import { AiCoachCard } from "@/components/AiCoachCard";
import { ChallengesPanel } from "@/components/ChallengesPanel";


export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Nosy Push-Ups — Dashboard" },
      {
        name: "description",
        content:
          "Zähle Push-Ups mit der Nase, sammle XP, halte deine Streak und tritt gegen Freunde an.",
      },
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
};

type DailyStat = { day: string; total_reps: number };

type PushMode = "nose" | "manual" | "camera";

function Dashboard() {
  const [exercises, setExercises] = useState<ExerciseMeta[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [todayReps, setTodayReps] = useState(0);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<PushMode>("nose");


  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setUserId(u.user.id);
      const today = new Date().toISOString().slice(0, 10);

      const [{ data: ex }, { data: p }, { data: ds }] = await Promise.all([
        supabase.from("exercises").select("*").order("sort_order"),
        supabase
          .from("profiles")
          .select(
            "id, display_name, avatar_url, best_count, personal_bests, xp, level, current_streak, longest_streak, last_workout_date",
          )
          .eq("id", u.user.id)
          .maybeSingle(),
        supabase
          .from("daily_stats")
          .select("day, total_reps")
          .eq("user_id", u.user.id)
          .eq("day", today)
          .maybeSingle(),
      ]);
      if (ex) setExercises(ex as ExerciseMeta[]);
      if (p) {
        const raw = p as unknown as Omit<Profile, "personal_bests"> & {
          personal_bests: Record<string, number> | null;
        };
        setProfile({ ...raw, personal_bests: raw.personal_bests ?? {} });
      }
      if (ds) setTodayReps((ds as DailyStat).total_reps);
      setLoading(false);
    })();
  }, []);

  const lp = useMemo(() => levelProgress(profile?.xp ?? 0), [profile?.xp]);
  const initials = (profile?.display_name || "?").slice(0, 1).toUpperCase();
  const streak = profile?.current_streak ?? 0;
  const streakActive = (() => {
    if (!profile?.last_workout_date) return false;
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    return profile.last_workout_date === today || profile.last_workout_date === yesterday;
  })();

  const pushupBest = profile?.personal_bests?.pushup ?? profile?.best_count ?? 0;
  const otherExercises = exercises.filter((e) => e.id !== "pushup");
  const pushupEx = exercises.find((e) => e.id === "pushup");

  return (
    <main className="relative mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pt-6 pb-10">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_12px_var(--color-primary)]" />
          <span className="text-sm font-medium tracking-widest uppercase text-muted-foreground">
            Nosy&nbsp;Push-Ups
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

      {/* Level + Streak Card */}
      <section className="mt-6 rounded-3xl border border-border bg-card/60 p-5 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              Level {lp.level} · {lp.title}
            </div>
            <div className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
              {lp.xp.toLocaleString("de-DE")} XP
            </div>
          </div>
          <div
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold ${
              streakActive && streak > 0
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-secondary text-muted-foreground"
            }`}
            title="Streak: Tage in Folge"
          >
            <span className="text-lg leading-none">{streak > 0 && streakActive ? "🔥" : "❄️"}</span>
            <span className="tabular-nums">{streak}</span>
          </div>
        </div>
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${lp.progress * 100}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          <span>{lp.xpIntoLevel} / {lp.xpForLevel} XP</span>
          <span>{lp.isMax ? "Max" : `Noch ${lp.xpToNext} XP`}</span>
        </div>
      </section>

      {/* Today / Best / Longest */}
      <section className="mt-3 grid grid-cols-3 gap-3">
        <Stat label="Heute" value={todayReps.toString()} unit="Reps" />
        <Stat label="Bestwert" value={pushupBest.toString()} unit="Push-Ups" />
        <Stat label="Längste Streak" value={(profile?.longest_streak ?? 0).toString()} unit="Tage" />
      </section>

      {/* Push-Up Hero CTA */}
      <section className="mt-6 overflow-hidden rounded-3xl border border-primary/40 bg-gradient-to-br from-primary/15 via-card/70 to-card/60 p-5 backdrop-blur">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-primary">Haupt-Übung</div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">Push-Ups</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Tippe das Handy mit der Nase an, halte manuell mit oder lass die Kamera zählen.
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

      {/* Battle + Leaderboard CTAs */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Link
          to="/battle"
          className="flex flex-col justify-between rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/15 to-card/60 p-4 backdrop-blur transition active:scale-[0.98]"
        >
          <div className="text-[10px] uppercase tracking-[0.25em] text-primary">Neu</div>
          <div className="mt-1 text-base font-semibold">⚔️ Battle</div>
          <div className="text-[11px] text-muted-foreground">1v1 Duell</div>
        </Link>
        <Link
          to="/leaderboard"
          className="flex flex-col justify-between rounded-2xl border border-border bg-card/60 p-4 backdrop-blur transition active:scale-[0.98]"
        >
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Social</div>
          <div className="mt-1 text-base font-semibold">🏆 Leaderboard</div>
          <div className="text-[11px] text-muted-foreground">Global & Freunde</div>
        </Link>
      </div>

      {/* Smart Coach (AI) */}
      <AiCoachCard />

      {/* Challenges */}
      {userId && <ChallengesPanel userId={userId} />}

      {/* Other exercises */}

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
        {unit && <span className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground">{unit}</span>}
      </div>
    </div>
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
