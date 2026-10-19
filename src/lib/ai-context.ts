/** Build a compact context pack from Nose-Pushup + Nexus Chat for Super-AI. */

import { supabase } from "@/integrations/supabase/client";
import { loadMessages, loadRoomsForUser } from "@/lib/chat-backend";
import { getMiraGrants, type MiraGrants } from "@/lib/alo-store";
import { getTrainingWeekBounds, sumTrainingWeekReps } from "@/lib/training-dates";

export type AppContextPack = {
  profile: Record<string, unknown> | null;
  weekReps: number | null;
  weeklyWorkoutCount: number | null;
  dailyStatsDays: number;
  recentWorkouts: Array<{ exercise_id: string | null; count: number; created_at: string }>;
  health: Array<{
    day: string;
    steps: number | null;
    sleep_min: number | null;
    active_kcal: number | null;
  }>;
  chatRooms: Array<{ name: string; description?: string | null }>;
  recentChat: Array<{ room?: string; content: string; created_at: string }>;
};

async function buildTrainingContext(userId: string): Promise<AppContextPack> {
  const cutoff = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);

  const week = getTrainingWeekBounds();
  const [profileResult, statsResult, workoutsResult, healthResult, weeklyWorkouts] =
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
        // Aggregates can drift when legacy database triggers execute twice.
        // Use this table only for entry coverage, never as a second rep total.
        .select("day")
        .eq("user_id", userId)
        .gte("day", cutoff)
        .order("day", { ascending: false })
        .limit(14),
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

  if (
    [profileResult, statsResult, workoutsResult, healthResult, weeklyWorkouts].some(
      (result) => result.error,
    )
  ) {
    throw new Error(
      "Freigegebene Trainings-/Gesundheitsdaten konnten nicht vollständig geladen werden. Es wurden keine App-Daten an Mira gesendet. Bitte erneut versuchen oder Freigabe widerrufen.",
    );
  }
  const profile = profileResult.data;
  const stats = statsResult.data;
  const workouts = workoutsResult.data;
  const health = healthResult.data;
  const days = (stats ?? []) as Array<{ day: string }>;
  const weekReps = weeklyWorkouts.error ? null : sumTrainingWeekReps(weeklyWorkouts.data ?? []);

  return {
    profile: (profile as Record<string, unknown> | null) ?? null,
    weekReps,
    weeklyWorkoutCount: weeklyWorkouts.error ? null : (weeklyWorkouts.data?.length ?? 0),
    dailyStatsDays: days.length,
    recentWorkouts: (workouts ?? []) as AppContextPack["recentWorkouts"],
    health: (health ?? []) as AppContextPack["health"],
    chatRooms: [],
    recentChat: [],
  };
}

/** No training or chat reads occur without the corresponding explicit grant. */
export async function buildAppContext(
  userId: string,
  grants: MiraGrants = getMiraGrants(userId),
): Promise<AppContextPack> {
  const context: AppContextPack = grants.training
    ? await buildTrainingContext(userId)
    : {
        profile: null,
        weekReps: null,
        weeklyWorkoutCount: null,
        dailyStatsDays: 0,
        recentWorkouts: [],
        health: [],
        chatRooms: [],
        recentChat: [],
      };
  if (grants.rooms.length) {
    const visible = (await loadRoomsForUser(userId)).filter((room) =>
      grants.rooms.includes(room.id),
    );
    context.chatRooms = visible.map((room) => ({ name: room.name, description: room.description }));
    for (const room of visible) {
      const { messages } = await loadMessages(
        userId,
        { kind: "room", id: room.id },
        { strict: true },
      );
      context.recentChat.push(
        ...messages
          .filter((m) => m.user_id !== "system")
          .slice(-20)
          .map((m) => ({
            room: room.name,
            content: m.content.slice(0, 1000),
            created_at: m.created_at,
          })),
      );
    }
    context.recentChat = context.recentChat
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 40);
  }
  return context;
}

export function contextToSystemBlock(ctx: AppContextPack): string {
  const p = ctx.profile ?? {};
  const name = (p.display_name as string) || "nicht angegeben";
  const by = p.birth_year as number | undefined;
  const age = by ? new Date().getFullYear() - by : null;
  return `Du bist Mira, die allgemeine KI in Alo (All in one). Nose-Pushup und Nexus Chat sind optionale verbundene Bereiche, nicht deine Hauptaufgabe. Nutze diese freigegebenen Daten nur, wenn sie für die Frage relevant sind. Antworte auf Deutsch, klar und hilfreich.

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

DATENABDECKUNG:
${ctx.dailyStatsDays} Tage mit Statistik-Einträgen im geladenen Zeitraum. Diese Anzahl ist kein Trainingsumfang. Wiederholungen ausschließlich aus den gespeicherten Trainings und ihrer Wochensumme ableiten; keine weiteren aggregierten Tageszahlen annehmen.

LETZTE WORKOUTS:
${ctx.recentWorkouts.map((w) => `- ${w.created_at?.slice(0, 10)} ${w.exercise_id ?? "unbekannt"} × ${w.count}`).join("\n") || "(keine Einträge im geladenen Zeitraum)"}

HEALTH (7d):
${ctx.health.map((h) => `- ${h.day}: ${h.steps ?? "unbekannt"} Schritte, ${h.sleep_min == null ? "unbekannt" : `${(h.sleep_min / 60).toFixed(1)} h`} Schlaf, ${h.active_kcal ?? "unbekannt"} aktive kcal`).join("\n") || "(keine Einträge im geladenen Zeitraum)"}

CHAT-RÄUME: ${ctx.chatRooms.map((r) => r.name).join(", ") || "(keine)"}
NACHRICHTEN AUS AUSGEWÄHLTEN NEXUS-RÄUMEN:
${ctx.recentChat.map((m) => `- [${m.room ?? "Raum"}] ${m.content}`).join("\n") || "(keine)"}

Du darfst Trainingspläne, Form-Tipps, Recovery und Chat-Zusammenfassungen geben. Keine medizinischen Diagnosen.`;
}
