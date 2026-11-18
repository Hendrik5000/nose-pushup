import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { localDateKey } from "@/lib/training-dates";
import { cachedRead, HOME_DATA_CACHE_TTL_MS } from "@/lib/cached-read";
import { parseHealthTodayRow, type HomeHealthToday } from "@/lib/home-day-widgets";

type HomeProfileData = Readonly<{
  display_name: string | null;
  avatar_url: string | null;
  current_streak: number | null;
  daily_goal: number | null;
}>;

type HomeDayDataOptions = Readonly<{
  fallbackName?: string | null;
}>;

const EMPTY_PROFILE: HomeProfileData = {
  display_name: null,
  avatar_url: null,
  current_streak: null,
  daily_goal: null,
};

async function loadHomeProfile(
  userId: string,
  fallbackName: string | null,
): Promise<HomeProfileData> {
  const { data } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, current_streak, daily_goal")
    .eq("id", userId)
    .maybeSingle();
  let current = data as HomeProfileData | null;
  if (!current && fallbackName !== null) {
    const { data: created } = await supabase
      .from("profiles")
      .insert({ id: userId, display_name: fallbackName })
      .select("display_name, avatar_url, current_streak, daily_goal")
      .maybeSingle();
    current = created as HomeProfileData | null;
  }
  return current ?? EMPTY_PROFILE;
}

/** Best-effort real data for the "Dein Tag" card; shared cached profile reads. */
export function useHomeDayData(
  userId: string,
  options: HomeDayDataOptions = {},
): {
  displayName: string | null;
  avatarUrl: string | null;
  healthToday: HomeHealthToday | null;
  streak: number;
  weeklyWorkouts: number | null;
  dailyReps: number | null;
  dailyGoal: number;
} {
  const [profile, setProfile] = useState<HomeProfileData>(EMPTY_PROFILE);
  const [healthToday, setHealthToday] = useState<HomeHealthToday | null>(null);
  const [streak, setStreak] = useState(0);
  const [weeklyWorkouts, setWeeklyWorkouts] = useState<number | null>(null);
  const [dailyReps, setDailyReps] = useState<number | null>(null);
  const [dailyGoal, setDailyGoal] = useState(0);

  useEffect(() => {
    let active = true;
    setProfile(EMPTY_PROFILE);
    setHealthToday(null);
    setStreak(0);
    setWeeklyWorkouts(null);
    setDailyReps(null);
    setDailyGoal(0);
    void (async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const today = localDateKey(new Date());
      const [health, workouts, daily, profileData] = await Promise.all([
        supabase
          .from("health_entries")
          .select("day, steps, active_kcal, sleep_min")
          .eq("user_id", userId)
          .eq("day", today)
          .maybeSingle(),
        supabase
          .from("workouts")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .gte("created_at", sevenDaysAgo),
        cachedRead(`alo-home-daily:${userId}:${today}`, HOME_DATA_CACHE_TTL_MS, async () => {
          const { data, error } = await supabase
            .from("daily_stats")
            .select("total_reps")
            .eq("user_id", userId)
            .eq("day", today)
            .maybeSingle();
          return { data, error };
        }),
        cachedRead(`alo-home-profile:${userId}`, HOME_DATA_CACHE_TTL_MS, () =>
          loadHomeProfile(userId, options.fallbackName ?? null),
        ).catch(() => EMPTY_PROFILE),
      ]);
      if (active) setHealthToday(health.error ? null : parseHealthTodayRow(health.data));
      if (active) setWeeklyWorkouts(workouts.error ? null : (workouts.count ?? 0));
      if (active) {
        const dailyRead = daily as { data: unknown; error: { message: string } | null };
        const row = dailyRead.data as { total_reps: number | null } | null;
        setDailyReps(dailyRead.error || !row ? null : (row.total_reps ?? 0));
      }
      if (active) {
        setStreak(profileData.current_streak ?? 0);
        setDailyGoal(profileData.daily_goal ?? 0);
        setProfile(profileData);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return {
    displayName: profile.display_name,
    avatarUrl: profile.avatar_url,
    healthToday,
    streak,
    weeklyWorkouts,
    dailyReps,
    dailyGoal,
  };
}
