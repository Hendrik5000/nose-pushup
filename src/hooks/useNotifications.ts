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

const CHECK_INTERVAL_MS = 60_000;

/**
 * Erinnert ans Training, wenn das Tagesziel noch offen ist, und meldet
 * neue Freundschaftsanfragen sowie Battle-Einladungen in Echtzeit.
 */
export function useNotifications() {
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    let channel: ReturnType<typeof supabase.channel> | undefined;

    const checkReminder = async () => {
      if (cancelled) return;
      if (!isNotifyEnabled()) return;
      if (reminderSentToday()) return;
      if (!reminderTimeReached()) return;

      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) return;

      const today = new Date().toISOString().slice(0, 10);
      const [{ data: prof }, { data: stat }] = await Promise.all([
        supabase.from("profiles").select("daily_goal, current_streak").eq("id", uid).maybeSingle(),
        supabase.from("daily_stats").select("total_reps").eq("user_id", uid).eq("day", today).maybeSingle(),
      ]);
      const goal = prof?.daily_goal ?? 50;
      const done = stat?.total_reps ?? 0;
      if (done >= goal) return;

      markReminderSent();
      const streak = prof?.current_streak ?? 0;
      const missing = Math.max(1, goal - done);
      await showNotification(
        streak > 0 ? `Streak retten: ${streak} Tage 🔥` : "Zeit für Push-Ups 💪",
        `Noch ${missing} Wiederholungen bis zu deinem Tagesziel.`,
        "np-daily-reminder",
      );
    };

    void checkReminder();
    timer = setInterval(() => void checkReminder(), CHECK_INTERVAL_MS);

    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid || cancelled) return;

      channel = supabase
        .channel("np-notifications")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "friendships", filter: `addressee_id=eq.${uid}` },
          () => {
            toast("Neue Freundschaftsanfrage", { description: "Schau im Profil unter Freunde vorbei." });
            void showNotification("Neue Freundschaftsanfrage", "Jemand möchte dich als Trainingspartner.", "np-friend");
          },
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "battles", filter: `host_id=eq.${uid}` },
          (payload) => {
            const row = payload.new as { status?: string; guest_id?: string | null };
            if (row.status === "active" && row.guest_id) {
              toast("Dein Battle startet", { description: "Ein Gegner ist beigetreten." });
              void showNotification("Battle startet", "Ein Gegner ist deinem Battle beigetreten.", "np-battle");
            }
          },
        )
        .subscribe();
    })();

    const onVisible = () => {
      if (document.visibilityState === "visible") void checkReminder();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      if (channel) void supabase.removeChannel(channel);
    };
  }, []);
}
