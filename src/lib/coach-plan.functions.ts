import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { WeekPlan } from "./coach-plan.server";

const MODEL = "google/gemini-3-flash-preview";

export const getWeekPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ({
    force: !!(input as { force?: boolean } | undefined)?.force,
  }))
  .handler(async ({ data, context }): Promise<WeekPlan> => {
    const { supabase, userId } = context;
    const { mondayOf, fallbackPlan, sanitizeDays } = await import("./coach-plan.server");
    const weekStart = mondayOf();

    if (!data.force) {
      const { data: existing } = await supabase
        .from("training_plans")
        .select("week_start, summary")
        .eq("user_id", userId)
        .eq("week_start", weekStart)
        .maybeSingle();
      if (existing) {
        const { data: days } = await supabase
          .from("plan_days")
          .select("day, focus, exercise_id, sets, reps, rest_s, note")
          .eq("user_id", userId)
          .gte("day", weekStart)
          .order("day");
        if (days && days.length) {
          return {
            week_start: weekStart,
            summary: existing.summary as string,
            days: days as WeekPlan["days"],
            source: "ai",
          };
        }
      }
    }

    // Kontext der letzten 14 Tage
    const cutoff = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
    const [{ data: profile }, { data: stats }] = await Promise.all([
      supabase
        .from("profiles")
        .select("level, xp, current_streak, best_count, birth_year, height_cm, weight_kg, daily_goal")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("daily_stats")
        .select("day, total_reps")
        .eq("user_id", userId)
        .gte("day", cutoff),
    ]);

    const days14 = (stats ?? []) as Array<{ day: string; total_reps: number }>;
    const weekReps = days14
      .filter((d) => +new Date(d.day) >= Date.now() - 7 * 86400000)
      .reduce((s, d) => s + d.total_reps, 0);
    const activeDays = days14.filter((d) => d.total_reps > 0).length;
    const best = profile?.best_count ?? 0;
    const streak = profile?.current_streak ?? 0;

    let plan: WeekPlan = fallbackPlan(weekStart, { best, streak, weekReps, activeDays });

    const key = process.env["LOVABLE_API_KEY"];
    if (key) {
      const prompt = `Du bist ein Calisthenics-Coach. Erstelle einen 7-Tage-Wochenplan (Montag zuerst).
Nutzer: Level ${profile?.level ?? 1}, Streak ${streak}, Push-Up-Bestwert ${best},
Reps letzte 7 Tage ${weekReps}, aktive Tage (14) ${activeDays},
Größe ${profile?.height_cm ?? "?"} cm, Gewicht ${profile?.weight_kg ?? "?"} kg, Jahrgang ${profile?.birth_year ?? "?"}.
Regeln: mindestens 1 Ruhetag, realistische Werte am Bestwert orientiert, bei wenigen aktiven Tagen sanfter starten.
Erlaubte exercise_id: pushup, situp, squat, plank, burpee oder null (Ruhetag).
Antworte NUR mit JSON:
{"summary":"1-2 Sätze","days":[{"focus":"push","exercise_id":"pushup","sets":3,"reps":12,"rest_s":60,"note":"kurz"}]}`;

      try {
        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "content-type": "application/json", "Lovable-API-Key": key },
          body: JSON.stringify({
            model: MODEL,
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
          }),
        });
        if (res.ok) {
          const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
          const parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "{}") as {
            summary?: string;
            days?: unknown;
          };
          const days = sanitizeDays(parsed.days, weekStart);
          if (days) {
            plan = {
              week_start: weekStart,
              summary: (parsed.summary ?? "").trim() || plan.summary,
              days,
              source: "ai",
            };
          }
        }
      } catch {
        /* Fallback bleibt bestehen */
      }
    }

    // Serverseitig speichern (Clients dürfen Pläne nicht schreiben)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: saved } = await supabaseAdmin
      .from("training_plans")
      .upsert(
        { user_id: userId, week_start: weekStart, summary: plan.summary, model: MODEL },
        { onConflict: "user_id,week_start" },
      )
      .select("id")
      .maybeSingle();

    if (saved?.id) {
      await supabaseAdmin.from("plan_days").delete().eq("plan_id", saved.id);
      await supabaseAdmin.from("plan_days").insert(
        plan.days.map((d) => ({
          plan_id: saved.id as string,
          user_id: userId,
          day: d.day,
          focus: d.focus,
          exercise_id: d.exercise_id,
          sets: d.sets,
          reps: d.reps,
          rest_s: d.rest_s,
          note: d.note,
        })),
      );
    }

    return plan;
  });
