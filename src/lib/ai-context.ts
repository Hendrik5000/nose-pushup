/** Build a compact context pack from Nose-Pushup + Nexus Chat for Super-AI. */

import { supabase } from "@/integrations/supabase/client";
import { loadChatStore } from "@/lib/local-chat";

export type AppContextPack = {
  profile: Record<string, unknown> | null;
  weekReps: number;
  recentWorkouts: Array<{ exercise_id: string | null; count: number; created_at: string }>;
  health: Array<{ day: string; steps: number; sleep_min: number; active_kcal: number }>;
  chatRooms: Array<{ name: string; description?: string | null }>;
  recentChat: Array<{ room?: string; content: string; created_at: string }>;
};

export async function buildAppContext(userId: string): Promise<AppContextPack> {
  const cutoff = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);

  const [{ data: profile }, { data: stats }, { data: workouts }, { data: health }, roomsRes] =
    await Promise.all([
      supabase
        .from("profiles")
        .select(
          "display_name, level, xp, current_streak, longest_streak, best_count, personal_bests, last_workout_date, birth_year, height_cm, weight_kg, sex, daily_goal",
        )
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("daily_stats")
        .select("day, total_reps")
        .eq("user_id", userId)
        .gte("day", cutoff),
      supabase
        .from("workouts")
        .select("exercise_id, count, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(12),
      supabase
        .from("health_entries")
        .select("day, steps, sleep_min, active_kcal")
        .eq("user_id", userId)
        .gte("day", cutoff)
        .order("day", { ascending: false })
        .limit(7),
      supabase.from("rooms" as never).select("name, description" as never).limit(10),
    ]);

  const days = (stats ?? []) as Array<{ day: string; total_reps: number }>;
  const weekReps = days
    .filter((d) => +new Date(d.day) >= Date.now() - 7 * 86400000)
    .reduce((s, d) => s + (d.total_reps ?? 0), 0);

  let chatRooms: AppContextPack["chatRooms"] = [];
  if (!roomsRes.error && roomsRes.data) {
    chatRooms = roomsRes.data as unknown as AppContextPack["chatRooms"];
  } else {
    const local = loadChatStore(userId);
    chatRooms = local.rooms.map((r) => ({ name: r.name, description: r.description }));
  }

  let recentChat: AppContextPack["recentChat"] = [];
  try {
    const { data: msgs } = await supabase
      .from("messages" as never)
      .select("content, created_at, room_id" as never)
      .eq("user_id" as never, userId as never)
      .order("created_at" as never, { ascending: false })
      .limit(15);
    if (msgs) {
      recentChat = (msgs as unknown as Array<{ content: string; created_at: string }>).map(
        (m) => ({
          content: String(m.content).slice(0, 200),
          created_at: m.created_at,
        }),
      );
    }
  } catch {
    /* tables may not exist yet */
  }
  if (recentChat.length === 0) {
    const local = loadChatStore(userId);
    recentChat = local.messages
      .slice(-15)
      .reverse()
      .map((m) => ({
        content: m.content.slice(0, 200),
        created_at: m.created_at,
      }));
  }

  return {
    profile: (profile as Record<string, unknown> | null) ?? null,
    weekReps,
    recentWorkouts: (workouts ?? []) as AppContextPack["recentWorkouts"],
    health: (health ?? []) as AppContextPack["health"],
    chatRooms,
    recentChat,
  };
}

export function contextToSystemBlock(ctx: AppContextPack): string {
  const p = ctx.profile ?? {};
  const name = (p.display_name as string) || "Athlet";
  const by = p.birth_year as number | undefined;
  const age = by ? new Date().getFullYear() - by : null;
  return `Du bist Super-AI in der Nose-Pushup / Nexus-Chat Super-App. Antworte auf Deutsch, knapp und hilfreich.

NUTZER:
- Name: ${name}
- Level/XP: ${p.level ?? 1} / ${p.xp ?? 0}
- Streak: ${p.current_streak ?? 0} (max ${p.longest_streak ?? 0})
- Best Push-Ups: ${p.best_count ?? 0}
- Tagesziel: ${p.daily_goal ?? 50}
- Körper: Alter ${age ?? "?"}, ${p.height_cm ?? "?"} cm, ${p.weight_kg ?? "?"} kg, ${p.sex ?? "?"}
- Reps 7 Tage: ${ctx.weekReps}
- Letztes Training: ${p.last_workout_date ?? "nie"}

LETZTE WORKOUTS:
${ctx.recentWorkouts.map((w) => `- ${w.created_at?.slice(0, 10)} ${w.exercise_id ?? "?"} × ${w.count}`).join("\n") || "(keine)"}

HEALTH (7d):
${ctx.health.map((h) => `- ${h.day}: ${h.steps} steps, ${(h.sleep_min / 60).toFixed(1)}h sleep`).join("\n") || "(keine)"}

CHAT-RÄUME: ${ctx.chatRooms.map((r) => r.name).join(", ") || "(keine)"}
LETZTE EIGENE CHAT-NACHRICHTEN:
${ctx.recentChat.map((m) => `- ${m.content}`).join("\n") || "(keine)"}

Du darfst Trainingspläne, Form-Tipps, Recovery und Chat-Zusammenfassungen geben. Keine medizinischen Diagnosen.`;
}
