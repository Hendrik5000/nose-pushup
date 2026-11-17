import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { localDateKey } from "@/lib/training-dates";
import { parseHealthTodayRow, type HomeHealthToday } from "@/lib/home-day-widgets";

/** Best-effort real data for the "Dein Tag" card: today's health entry and streak. */
export function useHomeDayData(userId: string): {
  healthToday: HomeHealthToday | null;
  streak: number;
} {
  const [healthToday, setHealthToday] = useState<HomeHealthToday | null>(null);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    let active = true;
    setHealthToday(null);
    setStreak(0);
    void (async () => {
      try {
        const { data } = await supabase
          .from("health_entries")
          .select("day, steps, active_kcal, sleep_min")
          .eq("user_id", userId)
          .eq("day", localDateKey(new Date()))
          .maybeSingle();
        if (active) setHealthToday(parseHealthTodayRow(data));
      } catch {
        if (active) setHealthToday(null);
      }
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

  return { healthToday, streak };
}
