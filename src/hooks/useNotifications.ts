import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  isNotifyEnabled,
  markReminderSent,
  reminderSentToday,
  reminderTimeReached,
  showNotification,
} from "@/lib/notifications";
import { cachedRead, HOME_DATA_CACHE_TTL_MS } from "@/lib/cached-read";

const CHECK_INTERVAL_MS = 60_000;

/**
 * Erinnert ans Training, wenn das Tagesziel noch offen ist, und meldet
 * den Start eigener Battles. Einladungen und Anrufe laufen über das Postfach.
 */
export function useNotifications(userId: string) {
  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    const checkReminder = async () => {
      if (cancelled || !isNotifyEnabled()) return;
      if (reminderSentToday() || !reminderTimeReached()) return;

      try {
        const today = new Date().toISOString().slice(0, 10);
        const [profileRead, statsRead] = await Promise.all([
          cachedRead(`alo-home-profile:${userId}`, HOME_DATA_CACHE_TTL_MS, async () => {
            const { data, error } = await supabase
              .from("profiles")
              .select("current_streak, daily_goal")
              .eq("id", userId)
              .maybeSingle();
            return { data, error };
          }),
          cachedRead(`alo-home-daily:${userId}:${today}`, HOME_DATA_CACHE_TTL_MS, async () => {
            const { data, error } = await supabase
              .from("daily_stats")
              .select("total_reps")
              .eq("user_id", userId)
              .eq("day", today)
              .maybeSingle();
            return { data, error };
          }),
        ]);
        if (cancelled || profileRead.error || statsRead.error) return;

        const goal = (profileRead.data as { daily_goal: number | null } | null)?.daily_goal ?? 50;
        const done = (statsRead.data as { total_reps: number | null } | null)?.total_reps ?? 0;
        if (done >= goal) return;

        markReminderSent();
        const streak =
          (profileRead.data as { current_streak: number | null } | null)?.current_streak ?? 0;
        const missing = Math.max(1, goal - done);
        await showNotification(
          streak > 0 ? `Streak retten: ${streak} Tage 🔥` : "Zeit für Push-Ups 💪",
          `Noch ${missing} Wiederholungen bis zu deinem Tagesziel.`,
          "np-daily-reminder",
        );
      } catch {
        // The reminder is best-effort; retry on the next interval/foreground event.
      }
    };

    void checkReminder();
    const timer = setInterval(() => void checkReminder(), CHECK_INTERVAL_MS);

    const channel = supabase
      .channel("np-notifications")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "battles", filter: `host_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as { status?: string; guest_id?: string | null };
          if (row.status === "active" && row.guest_id) {
            toast("Dein Battle startet", { description: "Ein Gegner ist beigetreten." });
            void showNotification(
              "Battle startet",
              "Ein Gegner ist deinem Battle beigetreten.",
              "np-battle",
            );
          }
        },
      )
      .subscribe();

    const onVisible = () => {
      if (document.visibilityState === "visible") void checkReminder();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [userId]);
}
