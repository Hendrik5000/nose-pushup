import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ExerciseMeta } from "@/lib/exercises";
import { levelProgress } from "@/lib/level";
import {
  getQuickStartPlan,
  getDashboardRecommendation,
  getSmartReminder,
  getWeeklyProgress,
} from "@/lib/workout-plans";
import { getTrainingWeekBounds, localDateKey, sumTrainingWeekReps } from "@/lib/training-dates";
import type { Readiness } from "@/lib/readiness";
import { AiCoachCard } from "@/components/AiCoachCard";
import { WeekPlanCard } from "@/components/WeekPlanCard";
import { ChallengesPanel } from "@/components/ChallengesPanel";
import { FriendActivity } from "@/components/FriendActivity";
import { WorkoutHistory } from "@/components/WorkoutHistory";
import { ReadinessCard } from "@/components/ReadinessCard";
import { MicroChallengeCard } from "@/components/MicroChallengeCard";
import { StreakFreezeCard } from "@/components/StreakFreezeCard";
import { RecoveryCalendar } from "@/components/RecoveryCalendar";
import { WeeklyReview } from "@/components/WeeklyReview";
import { BottomNav } from "@/components/BottomNav";
import { FavoriteStar } from "@/components/FavoriteStar";
import { DailyBriefingCard } from "@/components/DailyBriefingCard";
import { QuickActionsBar } from "@/components/QuickActionsBar";
import { MoodCheckin } from "@/components/MoodCheckin";
import { WaterTracker } from "@/components/WaterTracker";
import { WorkoutNotesPanel } from "@/components/WorkoutNotesPanel";
import { DashboardGrid } from "@/components/dashboard/DashboardGrid";
import type { WidgetId, WidgetSize } from "@/lib/dashboard-layout";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Nosy Push-Ups — Übersicht" },
      {
        name: "description",
        content:
          "Zähle Liegestütze mit der Nase, sammle Erfahrungspunkte und halte deine Trainingsserie.",
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
  const [hasWorkoutData, setHasWorkoutData] = useState(false);
  const [weekReps, setWeekReps] = useState<number | null>(null);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<PushMode>("nose");
  const [routineMode, setRoutineMode] = useState<"push" | "strength" | "mobility">("push");

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setUserId(u.user.id);
      const now = new Date();
      const today = localDateKey(now);
      const week = getTrainingWeekBounds(now);
      const [{ data: ex }, { data: p }, { data: he }, workouts] = await Promise.all([
        supabase.from("exercises").select("*").order("sort_order"),
        supabase.from("profiles").select(PROFILE_COLS).eq("id", u.user.id).maybeSingle(),
        supabase
          .from("health_entries")
          .select("steps")
          .eq("user_id", u.user.id)
          .eq("day", today)
          .maybeSingle(),
        supabase
          .from("workouts")
          .select("count, created_at")
          .eq("user_id", u.user.id)
          .eq("exercise_id", "pushup")
          .gte("created_at", week.startInclusive)
          .lt("created_at", week.endExclusive),
      ]);
      if (ex) setExercises(ex as ExerciseMeta[]);
      let prof = p;
      if (!prof) {
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
      setHasWorkoutData(!workouts.error && (workouts.data?.length ?? 0) > 0);
      setTodayReps(
        (workouts.data ?? []).reduce(
          (sum, row) =>
            row.created_at && localDateKey(new Date(row.created_at)) === today
              ? sum + (row.count ?? 0)
              : sum,
          0,
        ),
      );
      if (he) setTodaySteps(he.steps ?? 0);
      setWeekReps(workouts.error ? null : sumTrainingWeekReps(workouts.data ?? [], now));
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
    const today = localDateKey(new Date());
    const previous = new Date();
    previous.setDate(previous.getDate() - 1);
    const yesterday = localDateKey(previous);
    return profile.last_workout_date === today || profile.last_workout_date === yesterday;
  })();
  const pushupBest = profile?.personal_bests?.pushup ?? profile?.best_count ?? 0;
  const otherExercises = exercises.filter((e) => e.id !== "pushup");
  const quickStart = getQuickStartPlan({ best: pushupBest, todayReps, streak, goal });
  const pushupEx = exercises.find((e) => e.id === "pushup");
  const dateLabel = new Date().toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const weeklyTarget = goal * 7;
  const weeklyProgress =
    weekReps == null ? null : getWeeklyProgress({ weekReps, target: weeklyTarget });
  const recommendation = getDashboardRecommendation({
    plan: quickStart,
    readinessAvailable: readiness?.available ?? false,
    readinessLabel: readiness?.label,
    readinessLevel: readiness?.level,
  });
  const reminder = getSmartReminder({ todayReps, goal, streak });
  const routineConfig = {
    push: {
      label: "Drücktraining für den Oberkörper",
      sets: quickStart.sets,
      reps: quickStart.reps,
      rest: quickStart.rest_s,
    },
    strength: { label: "Ganzkörper-Krafttraining", sets: 3, reps: 12, rest: 50 },
    mobility: { label: "Mobilitätstraining", sets: 2, reps: 30, rest: 35 },
  } as const;
  const routine = routineConfig[routineMode];

  const wrap = (node: ReactNode, size: WidgetSize) => (
    <div className={size === "sm" ? "[&>section]:mt-0 [&>div]:mt-0" : "[&>section]:mt-0"}>
      {node}
    </div>
  );

  const renderWidget = (id: WidgetId, size: WidgetSize): ReactNode => {
    switch (id) {
      case "readiness":
        return wrap(<ReadinessCard streak={streak} onReadinessChange={setReadiness} />, size);
      case "briefing":
        return wrap(<DailyBriefingCard streak={streak} todayReps={todayReps} goal={goal} />, size);
      case "quickActions":
        return wrap(<QuickActionsBar />, size);
      case "mood":
        return wrap(<MoodCheckin />, size);
      case "water":
        return wrap(<WaterTracker />, size);
      case "notes":
        return wrap(<WorkoutNotesPanel />, size);
      case "microChallenge":
        return wrap(
          <MicroChallengeCard
            userId={userId}
            pushupBest={pushupBest}
            dailyGoal={goal}
            todayReps={todayReps}
            streak={streak}
            readinessLevel={readiness?.available ? readiness.level : "yellow"}
            plankBest={profile?.personal_bests?.plank}
          />,
          size,
        );
      case "streakFreeze":
        return wrap(<StreakFreezeCard streak={streak} />, size);
      case "recoveryCal":
        return wrap(<RecoveryCalendar userId={userId} />, size);
      case "statsRing":
        return wrap(
          <section className="rounded-3xl border border-border bg-card/60 p-5 backdrop-blur">
            <div className="flex items-center gap-5">
              <ActivityRing pct={goalPct} value={todayReps} goal={goal} />
              <div className="min-w-0 flex-1 space-y-2.5">
                <RingRow icon="🏆" label="Bestwert" value={`${pushupBest}`} />
                <RingRow
                  icon={streakActive && streak > 0 ? "🔥" : "❄️"}
                  label="Trainingsserie"
                  value={`${streak} Tage`}
                />
                <RingRow
                  icon="👟"
                  label="Schritte"
                  value={todaySteps ? todaySteps.toLocaleString("de-DE") : "—"}
                />
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
            </div>
          </section>,
          size,
        );
      case "reminder":
        return wrap(
          <section className="rounded-3xl border border-border bg-card/60 p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Trainingshinweis
            </div>
            <div className="mt-2 text-sm font-semibold">{reminder.title}</div>
            <p className="mt-1 text-xs text-muted-foreground">{reminder.text}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {weeklyProgress
                ? `Woche: ${weeklyProgress.weekReps} / ${weeklyProgress.target} Wiederholungen (${weeklyProgress.percent} %)`
                : "Wochenfortschritt noch nicht verfügbar."}
            </p>
          </section>,
          size,
        );
      case "miniBlock":
        return wrap(
          <section className="rounded-3xl border border-border bg-card/60 p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Mini-Block · {routine.label}
            </div>
            <div className="mt-2 flex gap-2">
              {(["push", "strength", "mobility"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  aria-pressed={routineMode === type}
                  onClick={() => setRoutineMode(type)}
                  className={`flex-1 rounded-xl border px-2 py-2 text-[10px] font-medium uppercase ${
                    routineMode === type ? "border-primary bg-primary/15" : "border-border"
                  }`}
                >
                  {type === "push"
                    ? "Drücken"
                    : type === "strength"
                      ? "Krafttraining"
                      : "Mobilität"}
                  {routineMode === type ? " · gewählt" : ""}
                </button>
              ))}
            </div>
            <Link
              to="/workout/$exerciseId"
              params={{ exerciseId: "pushup" }}
              search={{
                mode,
                sets: routine.sets,
                reps: routine.reps,
                rest_s: routine.rest,
                title: routine.label,
              }}
              className="mt-3 flex w-full items-center justify-center rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
            >
              Mini-Block starten →
            </Link>
          </section>,
          size,
        );
      case "tiles":
        return wrap(
          <section className="grid grid-cols-3 gap-2">
            <Tile to="/chat" icon="💬" label="Chat" />
            <Tile to="/health" icon="💚" label="Gesundheit" />
            <Tile to="/ai" icon="✦" label="Super-KI" />
            <Tile to="/programs" icon="📋" label="Programme" />
            <Tile to="/battle" icon="⚔️" label="Wettkampf" />
            <Tile to="/calisthenics" icon="🤸" label="Calisthenics" />
          </section>,
          size,
        );
      case "pushupHero":
        return wrap(
          <section className="rounded-3xl border border-border bg-card/50 p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.25em] text-primary">
                  Haupt-Übung
                </div>
                <h2 className="mt-1 text-3xl font-bold">Liegestütze</h2>
              </div>
              <span className="text-5xl">{pushupEx?.icon ?? "💪"}</span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <ModeChip
                active={mode === "nose"}
                onClick={() => setMode("nose")}
                icon="👃"
                label="Nase"
              />
              <ModeChip
                active={mode === "manual"}
                onClick={() => setMode("manual")}
                icon="👆"
                label="Manuell"
              />
              <ModeChip
                active={mode === "camera"}
                onClick={() => setMode("camera")}
                icon="📷"
                label="Kamera"
              />
            </div>
            <Link
              to="/workout/$exerciseId"
              params={{ exerciseId: "pushup" }}
              search={{ mode }}
              className="mt-4 flex w-full items-center justify-center rounded-2xl bg-primary px-4 py-4 text-base font-semibold text-primary-foreground"
            >
              Workout starten →
            </Link>
          </section>,
          size,
        );
      case "weekPlan":
        return wrap(<WeekPlanCard />, size);
      case "weeklyReview":
        return wrap(<WeeklyReview userId={userId} streak={streak} />, size);
      case "aiCoach":
        return wrap(<AiCoachCard />, size);
      case "challenges":
        return userId ? wrap(<ChallengesPanel userId={userId} />, size) : null;
      case "friends":
        return userId ? wrap(<FriendActivity userId={userId} />, size) : null;
      case "history":
        return userId ? wrap(<WorkoutHistory userId={userId} />, size) : null;
      case "exercises":
        return wrap(
          <section>
            <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Weitere Übungen
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {loading && (
                <div className="col-span-full rounded-2xl border border-border p-6 text-center text-sm text-muted-foreground">
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
                    className="flex flex-col gap-1 rounded-2xl border border-border bg-card/50 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-3xl">{ex.icon}</span>
                      <FavoriteStar exerciseId={ex.id} />
                    </div>
                    <span className="text-sm font-semibold">{ex.name}</span>
                    <span className="text-xs text-muted-foreground">Bestwert {best}</span>
                  </Link>
                );
              })}
            </div>
          </section>,
          size,
        );
      default:
        return null;
    }
  };

  return (
    <main className="relative mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col px-5 pt-6 pb-24">
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
          className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary text-sm font-semibold"
          aria-label="Profil"
        >
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            initials
          )}
        </Link>
      </header>

      <section
        className="mt-6 rounded-3xl border border-primary/25 bg-primary/5 p-5"
        aria-labelledby="today-plan-title"
      >
        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
          Dein Start heute · {recommendation.title}
        </div>
        <h2 id="today-plan-title" className="mt-2 text-2xl font-bold">
          {recommendation.headline}
        </h2>
        {weekReps === 0 && todayReps === 0 && (
          <p className="mt-2 text-sm text-muted-foreground">
            Schön, dass du da bist. Starte entspannt mit dem kurzen Plan unten – saubere Technik
            geht vor Tempo.
          </p>
        )}
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {recommendation.detail}
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <PlanMetric label="Sätze" value={recommendation.sets} />
          <PlanMetric label="Wiederholungen je Satz" value={recommendation.reps} />
          <PlanMetric label="Pause" value={`${recommendation.rest_s} s`} />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{recommendation.readinessNote}</p>
        <div className="mt-3 grid grid-cols-3 gap-2" aria-label="Zählmethode">
          <ModeChip
            active={mode === "nose"}
            onClick={() => setMode("nose")}
            icon="👃"
            label="Nase"
          />
          <ModeChip
            active={mode === "manual"}
            onClick={() => setMode("manual")}
            icon="✍️"
            label="Manuell"
          />
          <ModeChip
            active={mode === "camera"}
            onClick={() => setMode("camera")}
            icon="📷"
            label="Kamera"
          />
        </div>
        <Link
          to="/workout/$exerciseId"
          params={{ exerciseId: "pushup" }}
          search={{
            mode,
            sets: recommendation.sets,
            reps: recommendation.reps,
            rest_s: recommendation.rest_s,
            title: recommendation.title,
          }}
          className="mt-4 flex w-full items-center justify-center rounded-2xl bg-primary px-4 py-4 text-base font-semibold text-primary-foreground"
        >
          {recommendation.recoveryDay
            ? "Leichte Einheit (optional) →"
            : "Training nach Plan starten →"}
        </Link>
        <div className="mt-5 border-t border-border pt-4" aria-live="polite">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold">Diese Woche</h3>
            <span className="text-xs font-medium tabular-nums">
              {weekReps == null
                ? "Daten nicht verfügbar"
                : !hasWorkoutData
                  ? "Noch keine Daten"
                  : `${weekReps} / ${weeklyTarget} Wiederholungen`}
            </span>
          </div>
          {weekReps != null && hasWorkoutData && (
            <>
              <div
                className="mt-2 h-2 overflow-hidden rounded-full bg-secondary"
                role="meter"
                aria-label="Wochenziel-Fortschritt"
                aria-valuemin={0}
                aria-valuemax={weeklyTarget}
                aria-valuenow={Math.min(weekReps, weeklyTarget)}
              >
                <div
                  className="h-full rounded-full bg-primary"
                  style={{
                    width: `${Math.min(100, Math.round((weekReps / Math.max(weeklyTarget, 1)) * 100))}%`,
                  }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {weeklyProgress?.message} Ziel: {weeklyTarget} Wiederholungen (7 × Tagesziel {goal}
                ).
              </p>
            </>
          )}
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            Gezählt werden gespeicherte Liegestütz-Wiederholungen ab Montag 00:00 deiner lokalen
            Zeitzone. Maßgeblich ist der Zeitpunkt des Trainingsspeicherns; offline vorgemerkt
            behält dieses Datum.
          </p>
        </div>
      </section>

      <details className="mt-5">
        <summary className="cursor-pointer rounded-2xl border border-border bg-card px-4 py-3 text-sm font-semibold">
          Weitere Übersicht & Werkzeuge
        </summary>
        <p className="mt-2 text-xs text-muted-foreground">
          Readiness, Check-ins und zusätzliche Widgets findest du hier. Unsichere oder fehlende
          Messwerte werden als nicht verfügbar markiert.
        </p>
        <ReadinessCard streak={streak} onReadinessChange={setReadiness} />
        <DashboardGrid
          renderWidget={(id, size) => (id === "readiness" ? null : renderWidget(id, size))}
        />
      </details>

      <BottomNav />
    </main>
  );
}

function ActivityRing({ pct, value, goal }: { pct: number; value: number; goal: number }) {
  const r = 48;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-[110px] w-[110px] shrink-0">
      <svg width="110" height="110" className="-rotate-90">
        <circle
          cx="55"
          cy="55"
          r={r}
          fill="none"
          stroke="var(--color-secondary)"
          strokeWidth="10"
        />
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
        <span className="text-3xl font-bold tabular-nums">{value}</span>
        <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
          / {goal}
        </span>
      </div>
    </div>
  );
}

function RingRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-background/40 px-3 py-2">
      <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <span className="text-base">{icon}</span>
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
      className="flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-card/50 py-3 text-[10px] font-medium text-muted-foreground"
    >
      <span className="text-2xl">{icon}</span>
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
      type="button"
      aria-pressed={active}
      className={`flex min-w-0 flex-col items-center gap-1 rounded-xl border px-2 py-2 text-xs font-medium ${
        active
          ? "border-primary bg-primary/15"
          : "border-border bg-secondary/60 text-muted-foreground"
      }`}
    >
      <span className="text-lg">{icon}</span>
      <span className="text-center">{label}</span>
      {active && <span className="text-[10px] leading-tight">Ausgewählt</span>}
    </button>
  );
}

function PlanMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-card px-2 py-3">
      <div className="text-lg font-semibold">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
