import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { localDateKey } from "@/lib/training-dates";
import { parseHealthTodayRow, type HomeHealthToday } from "@/lib/home-day-widgets";

/** Best-effort real data for the "Dein Tag" card: today's health entry, streak and weekly workouts. */
export function useHomeDayData(userId: string): {
  healthToday: HomeHealthToday | null;
  streak: number;
  weeklyWorkouts: number | null;
  dailyReps: number | null;
  dailyGoal: number;
} {
  const [healthToday, setHealthToday] = useState<HomeHealthToday | null>(null);
  const [streak, setStreak] = useState(0);
  const [weeklyWorkouts, setWeeklyWorkouts] = useState<number | null>(null);
  const [dailyReps, setDailyReps] = useState<number | null>(null);
  const [dailyGoal, setDailyGoal] = useState(0);

  useEffect(() => {
    let active = true;
    setHealthToday(null);
    setStreak(0);
    setWeeklyWorkouts(null);
    setDailyReps(null);
    setDailyGoal(0);
    void (async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const today = localDateKey(new Date());
      const [health, workouts, daily] = await Promise.all([
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
        supabase
          .from("daily_stats")
          .select("total_reps")
          .eq("user_id", userId)
          .eq("day", today)
          .maybeSingle(),
      ]);
      if (active) setHealthToday(health.error ? null : parseHealthTodayRow(health.data));
      if (active) setWeeklyWorkouts(workouts.error ? null : (workouts.count ?? 0));
      if (active)
        setDailyReps(
          daily.error || !daily.data
            ? null
            : ((daily.data as { total_reps: number | null }).total_reps ?? 0),
        );
      try {
        const { data } = await supabase
          .from("profiles")
          .select("current_streak, daily_goal")
          .eq("id", userId)
          .maybeSingle();
        if (active) {
          setStreak((data as { current_streak: number | null } | null)?.current_streak ?? 0);
          setDailyGoal((data as { daily_goal: number | null } | null)?.daily_goal ?? 0);
        }
      } catch {
        if (active) setStreak(0);
      }
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  return { healthToday, streak, weeklyWorkouts, dailyReps, dailyGoal };
}
