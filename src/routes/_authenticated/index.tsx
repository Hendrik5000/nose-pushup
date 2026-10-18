import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ExerciseMeta } from "@/lib/exercises";
import { levelProgress } from "@/lib/level";
import {
  getCoachFocus,
  getQuickStartPlan,
  getRecoverySummary,
  getSmartReminder,
  getWeeklyProgress,
} from "@/lib/workout-plans";
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
import { DashboardExtras } from "@/components/DashboardExtras";
import { FavoriteStar } from "@/components/FavoriteStar";

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
  const [routineMode, setRoutineMode] = useState<"push" | "strength" | "mobility">("push");

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
          personal_bests: raw.personal_bests ?? {} as never
        };
      }
    })();
  }, []);

  return (
    <main className="relative mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pt-6">
      <h1 className="text-xl font-bold">Dashboard lädt…</h1>
      <p className="text-sm text-muted-foreground">Bitte Sync erneut — volle Datei wird wiederhergestellt.</p>
    </main>
  );
}
