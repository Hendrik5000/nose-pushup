import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { localDateKey } from "@/lib/training-dates";
import {
  computeReadiness,
  recordReadiness,
  readinessHistory,
  type Readiness,
} from "@/lib/readiness";

export function useReadiness({
  streak,
  onReadinessChange,
}: {
  streak: number;
  onReadinessChange?: (readiness: Readiness) => void;
}) {
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [history, setHistory] = useState<{ day: string; score: number }[]>([]);
  const [asOf, setAsOf] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user || !active) return;
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
      const [{ data: he, error: healthError }, workouts] = await Promise.all([
        supabase
          .from("health_entries")
          .select("sleep_min, steps")
          .eq("user_id", u.user.id)
          .eq("day", localDateKey(now))
          .maybeSingle(),
        supabase
          .from("workouts")
          .select("id", { count: "exact", head: true })
          .eq("user_id", u.user.id)
          .gte("created_at", sevenDaysAgo)
          .lte("created_at", now.toISOString()),
      ]);
      if (!active) return;

      const result = computeReadiness({
        sleepMin: healthError ? null : ((he as { sleep_min?: number } | null)?.sleep_min ?? null),
        steps: healthError ? null : ((he as { steps?: number } | null)?.steps ?? null),
        workoutsLast7Days: workouts.error ? null : (workouts.count ?? 0),
        streak,
      });
      if (result.available) {
        recordReadiness(result.score, u.user.id);
        setHistory(readinessHistory(u.user.id));
      } else {
        setHistory(readinessHistory(u.user.id));
      }
      setReadiness(result);
      onReadinessChange?.(result);
      setAsOf(now.toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" }));
    })();
    return () => {
      active = false;
    };
  }, [streak, onReadinessChange]);

  return { readiness, history, asOf };
}
