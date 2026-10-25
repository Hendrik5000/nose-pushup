import { progressState } from "@/lib/alo-ui";
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
import { AiCoachCard } from "@/components/AiCoachCard";
import { WeekPlanCard } from "@/components/WeekPlanCard";
import { ChallengesPanel } from "@/components/ChallengesPanel";
import { FriendActivity } from "@/components/FriendActivity";
import { WorkoutHistory } from "@/components/WorkoutHistory";
import { ReadinessSummary } from "@/components/ReadinessCard";
import { GymPartnerPanel } from "@/components/GymPartnerPanel";
import { useReadiness } from "@/hooks/useReadiness";
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
import { SportSectionLabel } from "@/components/SportPageIntro";
import {
  Activity,
  ArrowUpRight,
  Camera,
  ChevronDown,
  Dumbbell,
  Flame,
  Footprints,
  Hand,
  HeartPulse,
  LockKeyhole,
  Search,
  ScanFace,
  Target,
  Trophy,
  Users,
  Zap,
} from "lucide-react";

const MORE_AREAS = [
  { to: "/health", label: "Gesundheit" },
  { to: "/programs", label: "Programme" },
  { to: "/calisthenics", label: "Calisthenics" },
  { to: "/run", label: "Laufen" },
  { to: "/season", label: "Saison" },
  { to: "/battle", label: "Wettkampf" },
  { to: "/battle-league", label: "Battle-Liga" },
  { to: "/leaderboard", label: "Rangliste" },
  { to: "/clubs", label: "Clubs" },
] as const;

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Alo — All in one" },
      {
        name: "description",
        content: "Alo vereint Training, Mira für Alltag und Wissen sowie Nexus Chat an einem Ort.",
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

function HomeAppHub({
  displayName,
  avatarUrl,
}: {
  displayName: string | null | undefined;
  avatarUrl: string | null | undefined;
}) {
  const initials = displayName?.trim().slice(0, 1).toUpperCase() || "?";

  return (
    <section className="alo-tablet-home-hub mb-8" aria-labelledby="app-hub-title">
      <header className="mb-7 flex items-center justify-between gap-3">
        <h1 id="app-hub-title" className="text-2xl font-bold tracking-tight">
          Alo
        </h1>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            to="/profile"
            hash="profile-training"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition hover:border-primary/50 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            aria-label="Freunde öffnen"
            title="Freunde"
          >
            <Users className="h-5 w-5" aria-hidden="true" />
          </Link>
          <Link
            to="/profile"
            className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary text-sm font-semibold text-foreground shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            aria-label="Profil und Einstellungen öffnen"
            title="Profil und Einstellungen"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              initials
            )}
          </Link>
        </div>
      </header>
      <nav
        className="alo-tablet-home-apps grid w-full max-w-[520px] grid-cols-4 gap-x-2 gap-y-5 sm:grid-cols-5"
        aria-label="Alo-Apps"
      >
        <HubAppIcon to="/ai" title="Mira" artwork="mira" />
        <HubAppIcon to="/chat" title="Nexus Chat" artwork="nexus" />
        <HubAppIcon to="/exercises" title="Alo Health" artwork="health" />
        <HubAppIcon to="/profile" title="Einstellungen" artwork="settings" />
        <div
          role="img"
          aria-label="Spiel-App, gesperrt und noch nicht verfügbar"
          className="flex w-full min-w-0 flex-col items-center gap-2 text-center text-muted-foreground"
        >
          <span className="relative grid aspect-square w-full max-w-[72px] place-items-center overflow-hidden rounded-[20px] border border-dashed border-border bg-card/30 opacity-60 grayscale">
            <HubArtwork kind="adventure" />
            <span className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full border border-border bg-background text-muted-foreground shadow-sm">
              <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          </span>
          <span className="max-w-[84px] truncate text-[10px] font-medium leading-tight sm:text-xs">
            Spiel
          </span>
          <span className="-mt-1 text-[10px] leading-tight">Gesperrt</span>
        </div>
      </nav>
      <div className="alo-tablet-home-tools mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          className="alo-btn flex min-h-11 items-center justify-center gap-2"
          aria-label="Alo-Werkzeuge öffnen"
          onClick={() => window.dispatchEvent(new CustomEvent("alo-open", { detail: "menu" }))}
        >
          <Zap className="h-4 w-4" aria-hidden="true" />
          Alo-Werkzeuge
        </button>
        <button
          type="button"
          className="alo-btn flex min-h-11 items-center justify-center gap-2"
          aria-label="Überall suchen"
          onClick={() => window.dispatchEvent(new CustomEvent("alo-open", { detail: "search" }))}
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          Überall suchen
        </button>
      </div>
      <details className="mt-4 rounded-2xl border border-border bg-card/35 px-3">
        <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 font-medium">
          Weitere Bereiche
          <span className="text-xs text-muted-foreground">{MORE_AREAS.length}</span>
        </summary>
        <nav className="grid grid-cols-2 gap-2 pb-3" aria-label="Weitere Alo-Bereiche">
          {MORE_AREAS.map((area) => (
            <Link
              key={area.to}
              to={area.to}
              className="flex min-h-11 items-center rounded-xl border border-border/70 bg-background/40 px-3 text-sm font-medium transition hover:border-primary/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              {area.label}
            </Link>
          ))}
        </nav>
      </details>
    </section>
  );
}

function HubAppIcon({
  to,
  title,
  artwork,
}: {
  to: "/ai" | "/chat" | "/exercises" | "/profile";
  title: string;
  artwork: "mira" | "nexus" | "health" | "settings";
}) {
  return (
    <Link
      to={to}
      aria-label={`${title} öffnen`}
      className="group flex w-full min-w-0 flex-col items-center gap-2 rounded-xl text-center transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <span className="relative grid aspect-square w-full max-w-[72px] place-items-center overflow-hidden rounded-[20px] border border-white/10 bg-card shadow-md transition group-hover:scale-105 group-hover:shadow-lg">
        <HubArtwork kind={artwork} />
      </span>
      <span className="max-w-[84px] truncate text-[10px] font-medium leading-tight text-foreground sm:text-xs">
        {title}
      </span>
    </Link>
  );
}

function HubArtwork({ kind }: { kind: "mira" | "nexus" | "health" | "settings" | "adventure" }) {
  const palettes = {
    mira: { bg: "#211c37", accent: "#c4b5fd", glow: "#8b5cf6" },
    nexus: { bg: "#122d3a", accent: "#67e8f9", glow: "#0ea5e9" },
    health: { bg: "#15352e", accent: "#86efac", glow: "#10b981" },
    settings: { bg: "#3a2e1e", accent: "#fcd34d", glow: "#f59e0b" },
    adventure: { bg: "#30233d", accent: "#f0abfc", glow: "#c026d3" },
  } as const;
  const palette = palettes[kind];

  return (
    <svg
      viewBox="74 0 132 132"
      className="block h-full w-full"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="280" height="132" rx="18" fill={palette.bg} />
      <circle cx="232" cy="28" r="47" fill={palette.glow} opacity=".18" />
      <circle cx="35" cy="112" r="54" fill={palette.accent} opacity=".08" />
      {kind === "mira" && (
        <>
          <ellipse
            cx="140"
            cy="68"
            rx="64"
            ry="24"
            fill="none"
            stroke={palette.accent}
            strokeOpacity=".48"
            strokeWidth="2"
            transform="rotate(-18 140 68)"
          />
          <ellipse
            cx="140"
            cy="68"
            rx="42"
            ry="53"
            fill="none"
            stroke={palette.accent}
            strokeOpacity=".28"
            strokeWidth="2"
            transform="rotate(28 140 68)"
          />
          <circle cx="140" cy="66" r="20" fill={palette.glow} />
          <path d="m140 39 4 13 13 4-13 4-4 13-4-13-13-4 13-4 4-13Z" fill="#fff" />
          <circle cx="196" cy="38" r="4" fill="#fff" />
          <circle cx="82" cy="93" r="3" fill={palette.accent} />
        </>
      )}
      {kind === "nexus" && (
        <>
          <path
            d="M74 42h83a14 14 0 0 1 14 14v25a14 14 0 0 1-14 14h-8l-17 15V95H74a14 14 0 0 1-14-14V56a14 14 0 0 1 14-14Z"
            fill={palette.accent}
            opacity=".95"
          />
          <path
            d="M135 27h69a13 13 0 0 1 13 13v18a13 13 0 0 1-13 13h-9v14l-17-14h-43a13 13 0 0 1-13-13V40a13 13 0 0 1 13-13Z"
            fill="#e0f2fe"
            opacity=".94"
          />
          <circle cx="91" cy="68" r="4" fill="#123047" />
          <circle cx="110" cy="68" r="4" fill="#123047" />
          <circle cx="129" cy="68" r="4" fill="#123047" />
          <path d="M159 49h37" stroke="#0c4a6e" strokeWidth="4" strokeLinecap="round" />
          <path
            d="M159 58h25"
            stroke="#0c4a6e"
            strokeWidth="4"
            strokeLinecap="round"
            opacity=".55"
          />
        </>
      )}
      {kind === "health" && (
        <>
          <circle cx="140" cy="67" r="43" fill={palette.glow} opacity=".32" />
          <path
            d="M140 96 101 60a24 24 0 0 1 36-32l3 4 3-4a24 24 0 0 1 36 32l-39 36Z"
            fill={palette.accent}
          />
          <path
            d="M70 72h31l10-17 16 35 13-25 10 13h60"
            fill="none"
            stroke="#123b2e"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="209" cy="39" r="5" fill="#fff" opacity=".85" />
        </>
      )}
      {kind === "settings" && (
        <>
          <circle cx="140" cy="66" r="42" fill={palette.glow} opacity=".28" />
          <path
            d="M140 34a8 8 0 0 1 8 8v4a23 23 0 0 1 8 4l4-2a8 8 0 0 1 11 3l4 7a8 8 0 0 1-3 11l-4 2a24 24 0 0 1 0 9l4 2a8 8 0 0 1 3 11l-4 7a8 8 0 0 1-11 3l-4-2a23 23 0 0 1-8 4v4a8 8 0 0 1-8 8h-8a8 8 0 0 1-8-8v-4a23 23 0 0 1-8-4l-4 2a8 8 0 0 1-11-3l-4-7a8 8 0 0 1 3-11l4-2a24 24 0 0 1 0-9l-4-2a8 8 0 0 1-3-11l4-7a8 8 0 0 1 11-3l4 2a23 23 0 0 1 8-4v-4a8 8 0 0 1 8-8h8Z"
            fill={palette.accent}
            transform="translate(0 -7) scale(.92 1) translate(12 0)"
          />
          <circle cx="140" cy="66" r="18" fill={palette.bg} />
          <circle cx="140" cy="66" r="8" fill={palette.accent} />
          <path
            d="M202 43h23M213.5 31.5v23"
            stroke="#fff"
            strokeWidth="3"
            strokeLinecap="round"
            opacity=".8"
          />
        </>
      )}
      {kind === "adventure" && (
        <>
          <path d="M0 100 70 48l42 32 58-52 110 78v26H0Z" fill={palette.glow} opacity=".42" />
          <path d="m46 105 53-49 39 31 40-42 58 60Z" fill={palette.accent} opacity=".78" />
          <circle cx="202" cy="35" r="15" fill={palette.accent} opacity=".88" />
          <path
            d="M140 46v27m-13-13.5h26"
            stroke="#fff"
            strokeWidth="4"
            strokeLinecap="round"
            opacity=".9"
          />
        </>
      )}
      <path d="M18 18h22" stroke="#fff" strokeOpacity=".22" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function Dashboard() {
  const [exercises, setExercises] = useState<ExerciseMeta[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [todayReps, setTodayReps] = useState(0);
  const [todaySteps, setTodaySteps] = useState(0);
  const [hasTodayData, setHasTodayData] = useState(false);
  const [workoutAvailable, setWorkoutAvailable] = useState(true);
  const [hasWorkoutData, setHasWorkoutData] = useState(false);
  const [weekReps, setWeekReps] = useState<number | null>(null);
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
      setWorkoutAvailable(!workouts.error);
      setHasTodayData(
        !workouts.error &&
          (workouts.data ?? []).some(
            (row) => !!row.created_at && localDateKey(new Date(row.created_at)) === today,
          ),
      );
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
  const streak = profile?.current_streak ?? 0;
  const readinessData = useReadiness({ streak });
  const { readiness } = readinessData;
  const goal = profile?.daily_goal || 50;
  const todayProgress = progressState(loading, workoutAvailable, hasTodayData, todayReps);
  const goalPct = Math.min(1, todayReps / goal);
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
      case "trainingProgress":
        return wrap(
          <section
            className="training-progress rounded-3xl border border-border bg-card/60 p-4"
            aria-label="Trainingsfortschritt"
          >
            <h2 className="text-sm font-semibold">Dein Fortschritt</h2>
            <dl className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <dt className="text-xs text-muted-foreground">Tagesziel · Liegestütze</dt>
                <dd className="mt-1 text-xl font-bold tabular-nums">
                  {todayProgress.measured ? `${todayReps} / ${goal}` : todayProgress.label}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Trainingsserie</dt>
                <dd className="mt-1 text-xl font-bold tabular-nums">
                  {loading ? "—" : `${streak} ${streak === 1 ? "Tag" : "Tage"}`}
                </dd>
              </div>
            </dl>
            {todayProgress.measured && (
              <div
                className="mt-3 h-2 overflow-hidden rounded-full bg-secondary"
                role="meter"
                aria-label="Tagesziel-Fortschritt"
                aria-valuemin={0}
                aria-valuemax={goal}
                aria-valuenow={Math.min(todayReps, goal)}
              >
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${goalPct * 100}%` }}
                />
              </div>
            )}
            <div className="mt-4 border-t border-border pt-4" aria-live="polite">
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
                  <p className="mt-2 text-xs text-muted-foreground">{weeklyProgress?.message}</p>
                </>
              )}
              <details className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                <summary className="cursor-pointer">So wird gezählt</summary>
                <p className="mt-1">
                  Gezählt werden gespeicherte Liegestütz-Wiederholungen ab Montag 00:00 deiner
                  lokalen Zeitzone. Maßgeblich ist der Zeitpunkt des Trainingsspeicherns; offline
                  vorgemerkt behält dieses Datum. Das Wochenziel entspricht 7 × Tagesziel:{" "}
                  {weeklyTarget} Wiederholungen.
                </p>
              </details>
            </div>
          </section>,
          size,
        );

      case "readiness":
        return wrap(<ReadinessSummary {...readinessData} />, size);
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
            <details className="alo-stat-details">
              <summary>Bestwert, Schritte & Level · Details öffnen</summary>
              <div className="mt-3 space-y-2.5">
                <RingRow icon="🏆" label="Bestwert" value={`${pushupBest}`} />
                <RingRow
                  icon="👟"
                  label="Schritte"
                  value={todaySteps ? todaySteps.toLocaleString("de-DE") : "—"}
                />
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
            </details>
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
    <main className="alo-tablet-home-page relative mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col px-5 pt-6 pb-24">
      <HomeAppHub displayName={profile?.display_name} avatarUrl={profile?.avatar_url} />
      <details
        className="group rounded-3xl border border-border bg-card/45 shadow-sm"
        id="training-overview"
      >
        <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 rounded-3xl px-4 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary sm:px-5">
          <span className="min-w-0">
            <span className="block text-sm font-semibold">Trainingsübersicht & Gym-Partner</span>
            <span className="mt-1 block text-xs text-muted-foreground">
              Dein Plan, dein Fortschritt und deine privaten Trainingsverläufe
            </span>
          </span>
          <ChevronDown
            className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <div className="border-t border-border px-3 pb-4 pt-4 sm:px-5">
          <p className="mb-4 text-xs text-muted-foreground">
            Die bisherigen Trainingsfunktionen bleiben erhalten. Partnerdaten und dein eigener
            Verlauf bleiben getrennt.
          </p>
          <GymPartnerPanel />
          <header className="classic-only dashboard-header flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                {dateLabel}
              </div>
              <h1 className="mt-0.5 text-xl font-bold tracking-tight">
                Hallo {profile?.display_name || "Athlet"} 👋
              </h1>
            </div>
          </header>

          <div className="sport-only sport-dashboard-welcome">
            <div>
              <div className="sport-eyebrow">
                <span aria-hidden="true" />
                {dateLabel}
              </div>
              <h1 className="sport-dashboard-title">Heute trainieren</h1>
              <p className="sport-dashboard-subtitle">
                Hallo {profile?.display_name || "Athlet"}. Dein Plan und dein Fortschritt auf einen
                Blick.
              </p>
            </div>
          </div>
          <SportSectionLabel number="01">Dein Plan heute</SportSectionLabel>
          <section
            className="sport-only training-hero rounded-3xl border border-border bg-card p-5"
            aria-labelledby="sport-today-plan-title"
          >
            <div className="sport-hero-heading">
              <div className="sport-hero-mark">
                <Dumbbell aria-hidden="true" />
                {recommendation.title}
              </div>
              <h2 id="sport-today-plan-title">{recommendation.headline}</h2>
              <p>
                Dein Fokus: Liegestütze. Ein klarer Plan, saubere Wiederholungen, echter
                Fortschritt.
              </p>
            </div>
            <div className="training-plan-metrics grid grid-cols-3 gap-2 text-center">
              <PlanMetric label="Sätze" value={recommendation.sets} />
              <PlanMetric label="Wdh. je Satz" value={recommendation.reps} />
              <PlanMetric label="Pause" value={`${recommendation.rest_s} s`} />
            </div>
            <PlanGoalNote
              sets={recommendation.sets}
              reps={recommendation.reps}
              plannedReps={recommendation.plannedReps}
              goal={goal}
            />
            <label className="alo-counting-select">
              <span>Zählen</span>
              <select
                aria-label="Zählmethode auswählen"
                value={mode}
                onChange={(e) => setMode(e.target.value as typeof mode)}
              >
                <option value="nose">Nase</option>
                <option value="manual">Manuell</option>
                <option value="camera">Kamera</option>
              </select>
            </label>
            <div className="sport-counting-group" role="group" aria-label="Zählmethode">
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
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Nasenmodus: Tippe den Zähler mit der Nase an. Kamera zählt automatisch; manuell
              erfasst du selbst.
            </p>
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
              className="flex rounded-2xl bg-primary px-4 py-4 text-sm font-semibold text-primary-foreground"
            >
              <Zap className="h-4 w-4" aria-hidden="true" />
              {recommendation.recoveryDay ? "Leichte Einheit starten" : "Training starten"}
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <p className="text-xs text-muted-foreground">{recommendation.readinessNote}</p>
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">Warum dieser Plan?</summary>
              <p className="mt-2 leading-relaxed">{recommendation.detail}</p>
              <p className="alo-mobile-plan-context mt-2">
                Dein Fokus: Liegestütze. Ein klarer Plan, saubere Wiederholungen, echter
                Fortschritt.
              </p>
              {weekReps === 0 && todayReps === 0 && (
                <p className="mt-2">Starte entspannt – saubere Technik geht vor Tempo.</p>
              )}
            </details>
          </section>
          <SportSectionLabel number="02">Finde deinen Fokus</SportSectionLabel>
          <nav className="sport-only sport-shortcuts" aria-label="Trainingsbereiche">
            <Link to="/exercises" className="sport-shortcut">
              <Dumbbell aria-hidden="true" />
              <span>
                Alle Übungen
                <ArrowUpRight aria-hidden="true" />
              </span>
            </Link>
            <Link to="/programs" className="sport-shortcut">
              <Target aria-hidden="true" />
              <span>
                Programme
                <ArrowUpRight aria-hidden="true" />
              </span>
            </Link>
            <Link to="/calisthenics" className="sport-shortcut">
              <Activity aria-hidden="true" />
              <span>
                Calisthenics
                <ArrowUpRight aria-hidden="true" />
              </span>
            </Link>
            <Link to="/health" className="sport-shortcut">
              <HeartPulse aria-hidden="true" />
              <span>
                Gesundheit
                <ArrowUpRight aria-hidden="true" />
              </span>
            </Link>
          </nav>
          <section
            className="classic-only training-hero mt-6 rounded-3xl border border-primary/25 bg-primary/5 p-5"
            aria-labelledby="today-plan-title"
          >
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
              Dein Start heute · {recommendation.title}
            </div>
            <h2 id="today-plan-title" className="mt-2 text-2xl font-bold">
              {recommendation.headline}
            </h2>
            <div className="training-plan-metrics mt-4 grid grid-cols-3 gap-2 text-center">
              <PlanMetric label="Sätze" value={recommendation.sets} />
              <PlanMetric label="Wiederholungen je Satz" value={recommendation.reps} />
              <PlanMetric label="Pause" value={`${recommendation.rest_s} s`} />
            </div>
            <PlanGoalNote
              sets={recommendation.sets}
              reps={recommendation.reps}
              plannedReps={recommendation.plannedReps}
              goal={goal}
            />
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
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Nasenmodus: Tippe den Zähler mit der Nase an. Kamera zählt automatisch; manuell
              erfasst du selbst.
            </p>
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
            <p className="mt-3 text-xs text-muted-foreground">{recommendation.readinessNote}</p>
            <details className="mt-3 text-xs text-muted-foreground">
              <summary className="cursor-pointer">Warum dieser Plan?</summary>
              <p className="mt-2 leading-relaxed">{recommendation.detail}</p>
              {weekReps === 0 && todayReps === 0 && (
                <p className="mt-2">Starte entspannt – saubere Technik geht vor Tempo.</p>
              )}
            </details>
          </section>

          <section className="alo-home-intro" aria-label="Deine Alo-Bereiche">
            <button
              className="alo-text-action"
              onClick={() => window.dispatchEvent(new CustomEvent("alo-open", { detail: "today" }))}
            >
              Deinen Tag überblicken →
            </button>
            <details className="alo-home-areas">
              <summary>Mira, Nexus & Training öffnen</summary>
              <div className="alo-home-portals">
                <Link
                  to="/workout/$exerciseId"
                  params={{ exerciseId: "pushup" }}
                  search={{
                    mode: "nose",
                    sets: 3,
                    reps: 8,
                    rest_s: 60,
                    title: "Liegestütztraining",
                  }}
                  className="rounded-2xl border border-primary/40 bg-primary/10 p-4 transition hover:bg-primary/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                    01 · Training
                  </span>
                  <h2 className="mt-1 text-lg font-bold">Liegestütztraining</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Liegestütze erfassen: Nase tippt den Zähler, alternativ Kamera oder manuell.
                  </p>
                  <span className="mt-3 inline-block text-sm font-semibold">
                    Training starten →
                  </span>
                </Link>
                <Link
                  to="/ai"
                  className="rounded-2xl border border-border bg-card/70 p-4 transition hover:border-primary/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                    02 · Allgemeine KI
                  </span>
                  <h2 className="mt-1 text-lg font-bold">Mira</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Wissen, Schreiben, Ideen, Alltag – deine vielseitige KI.
                  </p>
                  <span className="mt-3 inline-block text-sm font-semibold">Mira fragen →</span>
                </Link>
                <Link
                  to="/chat"
                  className="rounded-2xl border border-border bg-card/70 p-4 transition hover:border-primary/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                    03 · Gemeinsam
                  </span>
                  <h2 className="mt-1 text-lg font-bold">Nexus Chat</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Deine Gespräche bleiben lokal auf diesem Gerät.
                  </p>
                  <span className="mt-3 inline-block text-sm font-semibold">Nexus öffnen →</span>
                </Link>
              </div>
            </details>
          </section>

          <DashboardGrid renderWidget={renderWidget} />
        </div>
      </details>
      <BottomNav />
    </main>
  );
}

function RingRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-background/40 px-3 py-2">
      <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <span className="classic-only text-base">{icon}</span>
        <span className="sport-only">
          {label === "Bestwert" ? (
            <Trophy className="h-4 w-4 text-primary" aria-hidden="true" />
          ) : label === "Trainingsserie" ? (
            <Flame className="h-4 w-4 text-primary" aria-hidden="true" />
          ) : (
            <Footprints className="h-4 w-4 text-primary" aria-hidden="true" />
          )}
        </span>
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
      className={`counting-mode flex min-w-0 flex-col items-center gap-1 rounded-xl border px-2 py-2 text-xs font-medium ${
        active
          ? "border-primary bg-primary/15"
          : "border-border bg-secondary/60 text-muted-foreground"
      }`}
    >
      <span className="classic-only text-lg">{icon}</span>
      <span className="sport-only" aria-hidden="true">
        {label === "Kamera" ? (
          <Camera className="h-4 w-4" />
        ) : label === "Manuell" ? (
          <Hand className="h-4 w-4" />
        ) : (
          <ScanFace className="h-4 w-4" />
        )}
      </span>
      <span className="text-center">{label}</span>
      {active && <span className="text-[10px] leading-tight">Ausgewählt</span>}
    </button>
  );
}

function PlanMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="plan-metric rounded-xl border border-border bg-card px-2 py-3">
      <div className="plan-metric-value text-lg font-semibold">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function PlanGoalNote({
  sets,
  reps,
  plannedReps,
  goal,
}: {
  sets: number;
  reps: number;
  plannedReps: number;
  goal: number;
}) {
  return (
    <p className="text-xs leading-relaxed text-muted-foreground">
      Dieser Startplan: {sets} × {reps} = {plannedReps} Wiederholungen – ein Schritt zum Tagesziel
      von {goal}. Das Ziel gilt für den Tag, nicht für eine einzelne Einheit. Steigere nur, wenn es
      sich gut anfühlt.
    </p>
  );
}
