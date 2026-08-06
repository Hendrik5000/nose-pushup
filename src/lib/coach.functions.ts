import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type CoachOutput = {
  advice: string;
  plan: { sets: number; reps: number; rest_s: number };
  source: "ai" | "fallback";
};

const MODEL = "google/gemini-3-flash-preview";
const RATE_LIMIT_MS = 60 * 60 * 1000; // 1 h

function fallbackAdvice(best: number, weekReps: number, streak: number): CoachOutput {
  const target = Math.max(12, Math.round((best || 10) * 1.1) + 2);
  const perSet = Math.max(5, Math.round(target / 4));
  const advice =
    streak === 0
      ? "Frischer Start. Bau in kurzen Sets Vertrauen auf und halte die Form sauber."
      : weekReps < 100
        ? `Nicht viel los diese Woche (${weekReps} Reps). Ein solider Session-Push heute bringt dich zurück in den Flow.`
        : `Solide Woche mit ${weekReps} Reps. Halte das Tempo, aber gönn dir volle Kontrolle auf dem Weg nach unten.`;
  return { advice, plan: { sets: 4, reps: perSet, rest_s: 60 }, source: "fallback" };
}

export const getCoachAdvice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const force = !!(input as { force?: boolean } | undefined)?.force;
    return { force };
  })
  .handler(async ({ data, context }): Promise<CoachOutput & { cached_at: string }> => {
    const { supabase, userId } = context;

    // Rate-limit: reuse last advice if fresh
    const { data: last } = await supabase
      .from("coach_advice")
      .select("advice, plan, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data.force && last) {
      const age = Date.now() - +new Date(last.created_at as string);
      if (age < RATE_LIMIT_MS) {
        const plan = (last.plan ?? {}) as CoachOutput["plan"];
        return {
          advice: last.advice as string,
          plan: {
            sets: plan.sets ?? 4,
            reps: plan.reps ?? 12,
            rest_s: plan.rest_s ?? 60,
          },
          source: "ai",
          cached_at: last.created_at as string,
        };
      }
    }

    // Gather context
    const today = new Date();
    const cutoff = new Date(today.getTime() - 14 * 86400000).toISOString().slice(0, 10);
    const [{ data: profile }, { data: stats }] = await Promise.all([
      supabase
        .from("profiles")
        .select("level, xp, current_streak, longest_streak, best_count, last_workout_date")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("daily_stats")
        .select("day, total_reps, sessions")
        .eq("user_id", userId)
        .gte("day", cutoff)
        .order("day", { ascending: true }),
    ]);

    const days = (stats ?? []) as Array<{ day: string; total_reps: number; sessions: number }>;
    const weekReps = days
      .filter((d) => +new Date(d.day) >= Date.now() - 7 * 86400000)
      .reduce((s, d) => s + d.total_reps, 0);
    const totalReps14 = days.reduce((s, d) => s + d.total_reps, 0);
    const activeDays = days.filter((d) => d.total_reps > 0).length;
    const best = profile?.best_count ?? 0;
    const streak = profile?.current_streak ?? 0;

    const key = process.env.LOVABLE_API_KEY;
    if (!key) {
      const fb = fallbackAdvice(best, weekReps, streak);
      return { ...fb, cached_at: new Date().toISOString() };
    }

    const prompt = `Du bist ein motivierender, knapper Push-Up-Coach. Antworte auf Deutsch.
Nutzerdaten (letzte 14 Tage):
- Level: ${profile?.level ?? 1}, XP: ${profile?.xp ?? 0}
- Streak: ${streak} Tage (längste: ${profile?.longest_streak ?? 0})
- Push-Up Bestwert: ${best}
- Reps letzte 7 Tage: ${weekReps}
- Reps letzte 14 Tage: ${totalReps14}
- Aktive Tage (14): ${activeDays}
- Letztes Training: ${profile?.last_workout_date ?? "nie"}

Gib zurück:
1. "advice": 2–3 kurze Sätze Feedback + Motivation, direkte Ansprache.
2. "plan": konkreter Trainingsvorschlag als JSON { "sets": <int>, "reps": <int>, "rest_s": <int> } — realistisch, an Bestwert angelehnt.

Antworte AUSSCHLIESSLICH mit JSON: { "advice": "...", "plan": { "sets": 4, "reps": 12, "rest_s": 60 } }`;

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "Lovable-API-Key": key,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
        }),
      });
      if (!res.ok) {
        const fb = fallbackAdvice(best, weekReps, streak);
        return { ...fb, cached_at: new Date().toISOString() };
      }
      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const raw = json.choices?.[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(raw) as {
        advice?: string;
        plan?: { sets?: number; reps?: number; rest_s?: number };
      };
      const plan = {
        sets: Math.max(1, Math.min(10, parsed.plan?.sets ?? 4)),
        reps: Math.max(3, Math.min(200, parsed.plan?.reps ?? 12)),
        rest_s: Math.max(15, Math.min(300, parsed.plan?.rest_s ?? 60)),
      };
      const advice = (parsed.advice ?? "").trim() || fallbackAdvice(best, weekReps, streak).advice;

      const { data: inserted } = await supabase
        .from("coach_advice")
        .insert({ user_id: userId, advice, plan, model: MODEL })
        .select("created_at")
        .maybeSingle();

      try {
        const { sendPushNotification } = await import("./push-notifications.server");
        await sendPushNotification(userId, {
          title: "Neuer Tipp vom Coach! 💡",
          body: advice.length > 100 ? advice.substring(0, 97) + "..." : advice,
          url: "/coach"
        });
      } catch (pushErr) {
        console.error("Push fail:", pushErr);
      }

      return {
        advice,
        plan,
        source: "ai",
        cached_at: (inserted?.created_at as string) ?? new Date().toISOString(),
      };
    } catch {
      const fb = fallbackAdvice(best, weekReps, streak);
      return { ...fb, cached_at: new Date().toISOString() };
    }
  });
