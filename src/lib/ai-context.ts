/** Build a compact context pack from Nose-Pushup + Nexus Chat for Super-AI. */

import { supabase } from "@/integrations/supabase/client";
import { loadChatStore } from "@/lib/local-chat";
import { getTrainingWeekBounds, sumTrainingWeekReps } from "@/lib/training-dates";

export type AppContextPack = {
  profile: Record<string, unknown> | null;
  weekReps: number | null;
  weeklyWorkoutCount: number | null;
  dailyStatsDays: number;
  recentWorkouts: Array<{ exercise_id: string | null; count: number; created_at: string }>;
  health: Array<{ day: string; steps: number; sleep_min: number; active_kcal: number }>;
  chatRooms: Array<{ name: string; description?: string | null }>;
  recentChat: Array<{ room?: string; content: string; created_at: string }>;
};

export async function buildAppContext(userId: string): Promise<AppContextPack> {
  const cutoff = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);

  const week = getTrainingWeekBounds();
  const [{ data: profile }, { data: stats }, { data: workouts }, { data: health }, weeklyWorkouts] =
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
      supabase
        .from("workouts")
        .select("count, created_at")
        .eq("user_id", userId)
        .eq("exercise_id", "pushup")
        .gte("created_at", week.startInclusive)
        .lt("created_at", week.endExclusive),
    ]);

  const days = (stats ?? []) as Array<{ day: string; total_reps: number }>;
  const weekReps = weeklyWorkouts.error ? null : sumTrainingWeekReps(weeklyWorkouts.data ?? []);
  // Rooms and fallback messages are always scoped to this account. Never include
  // a device's system welcome message as if it were the user's own message.
  const local = loadChatStore(userId);
  const chatRooms = local.rooms.map((r) => ({ name: r.name, description: r.description }));

  let recentChat: AppContextPack["recentChat"] = [];
  try {
    const { data: msgs } = await supabase
      .from("messages" as never)
      .select("content, created_at, room_id" as never)
      .eq("user_id" as never, userId as never)
      .order("created_at" as never, { ascending: false })
      .limit(15);
    if (msgs) {
      recentChat = (msgs as unknown as Array<{ content: string; created_at: string }>).map((m) => ({
        content: String(m.content).slice(0, 200),
        created_at: m.created_at,
      }));
    }
  } catch {
    /* tables may not exist yet */
  }
  if (recentChat.length === 0) {
    const local = loadChatStore(userId);
    recentChat = local.messages
      .filter((message) => message.user_id === userId)
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
    weeklyWorkoutCount: weeklyWorkouts.error ? null : (weeklyWorkouts.data?.length ?? 0),
    dailyStatsDays: days.length,
    recentWorkouts: (workouts ?? []) as AppContextPack["recentWorkouts"],
    health: (health ?? []) as AppContextPack["health"],
    chatRooms,
    recentChat,
  };
}

export function contextToSystemBlock(ctx: AppContextPack): string {
  const p = ctx.profile ?? {};
  const name = (p.display_name as string) || "nicht angegeben";
  const by = p.birth_year as number | undefined;
  const age = by ? new Date().getFullYear() - by : null;
  return `Du bist Super-AI in der Nose-Pushup / Nexus-Chat Super-App. Antworte auf Deutsch, knapp und hilfreich. Erkläre App-Begriffe wie Routing in einfacher Sprache.

DATENREGELN:
- Verwende ausschließlich die Fakten in diesem Kontext und den Nachrichten des Nutzers. Erfinde keine Workouts, Health-Werte, Vorlieben, Verletzungen oder Vorgeschichte.
- „keine Einträge“ bedeutet, dass im geladenen Zeitraum keine Datensätze vorliegen; es bedeutet nicht, dass der Wert null war. Fehlende Werte sind unbekannt.
- Fehlt für eine sichere oder persönliche Trainingsempfehlung wichtiger Kontext (z. B. Schmerzen/Verletzungen, verfügbares Equipment, Erfahrungsstand oder Zeit), stelle zuerst eine gezielte Rückfrage statt ihn anzunehmen.
- Bei einem einzelnen konkreten Trainingsvorschlag gib zusätzlich eine strukturierte Planvorschau zurück. Antworte dafür als JSON: {"reply":"kurze Erklärung","plan":{"title":"...","exercise_id":"pushup|situp|squat|plank|burpee","sets":3,"reps":8,"rest_s":60,"rationale":"kurze Begründung"}}. Alle Planwerte müssen explizit und realistisch sein. Wenn der nötige Kontext fehlt, frage nach und lasse plan weg. Bei anderen Anliegen antworte normal als Text.

NUTZER:
- Name: ${name}
- Level/XP: ${p.level ?? "nicht hinterlegt"} / ${p.xp ?? "nicht hinterlegt"}
- Streak: ${p.current_streak ?? "nicht hinterlegt"} (max ${p.longest_streak ?? "nicht hinterlegt"})
- Best Push-Ups: ${p.best_count ?? "nicht hinterlegt"}
- Tagesziel: ${p.daily_goal ?? "nicht hinterlegt"}
- Körper: Alter ${age ?? "?"}, ${p.height_cm ?? "?"} cm, ${p.weight_kg ?? "?"} kg, ${p.sex ?? "?"}
- Liegestütze diese Kalenderwoche (lokal ab Montag): ${ctx.weekReps == null ? "nicht verfügbar" : ctx.weeklyWorkoutCount === 0 ? "noch keine gespeicherten Workouts" : ctx.weekReps}
- Letztes Training: ${p.last_workout_date ?? "nicht hinterlegt"}

LETZTE WORKOUTS:
${ctx.recentWorkouts.map((w) => `- ${w.created_at?.slice(0, 10)} ${w.exercise_id ?? "unbekannt"} × ${w.count}`).join("\n") || "(keine Einträge im geladenen Zeitraum)"}

HEALTH (7d):
${ctx.health.map((h) => `- ${h.day}: ${h.steps ?? "unbekannt"} Schritte, ${h.sleep_min == null ? "unbekannt" : `${(h.sleep_min / 60).toFixed(1)} h`} Schlaf, ${h.active_kcal ?? "unbekannt"} aktive kcal`).join("\n") || "(keine Einträge im geladenen Zeitraum)"}

CHAT-RÄUME: ${ctx.chatRooms.map((r) => r.name).join(", ") || "(keine)"}
LETZTE EIGENE CHAT-NACHRICHTEN:
${ctx.recentChat.map((m) => `- ${m.content}`).join("\n") || "(keine)"}

Du darfst Trainingspläne, Form-Tipps, Recovery und Chat-Zusammenfassungen geben. Keine medizinischen Diagnosen.`;
}
