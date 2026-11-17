import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { localDateKey } from "@/lib/training-dates";
import { parseHealthTodayRow, type HomeHealthToday } from "@/lib/home-day-widgets";

/** Best-effort real data for the "Dein Tag" card: today's health entry, streak and weekly workouts. */
export function useHomeDayData(userId: string): {
  healthToday: HomeHealthToday | null;
  streak: number;
  weeklyWorkouts: number | null;
} {
  const [healthToday, setHealthToday] = useState<HomeHealthToday | null>(null);
  const [streak, setStreak] = useState(0);
  const [weeklyWorkouts, setWeeklyWorkouts] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    setHealthToday(null);
    setStreak(0);
    setWeeklyWorkouts(null);
    void (async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const [health, workouts] = await Promise.all([
        supabase
          .from("health_entries")
          .select("day, steps, active_kcal, sleep_min")
          .eq("user_id", userId)
          .eq("day", localDateKey(new Date()))
          .maybeSingle(),
        supabase
          .from("workouts")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .gte("created_at", sevenDaysAgo),
      ]);
      if (active) setHealthToday(health.error ? null : parseHealthTodayRow(health.data));
      if (active) setWeeklyWorkouts(workouts.error ? null : (workouts.count ?? 0));
      try {
        const { data } = await supabase
          .from("profiles")
          .select("current_streak")
          .eq("id", userId)
          .maybeSingle();
        if (active)
          setStreak((data as { current_streak: number | null } | null)?.current_streak ?? 0);
      } catch {
        if (active) setStreak(0);
      }
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  return { healthToday, streak, weeklyWorkouts };
}
