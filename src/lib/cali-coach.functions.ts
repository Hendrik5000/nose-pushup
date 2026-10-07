import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MODEL = "google/gemini-3-flash-preview";

export type PlateauAdvice = {
  advice: string;
  cached: boolean;
};

/**
 * Konkrete Handlungsempfehlung bei Plateau eines Cali-Skills.
 * Ergebnis wird in coach_advice gecacht (1x pro Skill pro Woche).
 */
export const getPlateauAdvice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const o = (input ?? {}) as Record<string, unknown>;
    return {
      skillId: String(o["skillId"] ?? "").slice(0, 60),
      skillName: String(o["skillName"] ?? "").slice(0, 80),
      recentBest: Number(o["recentBest"] ?? 0),
      previousBest: Number(o["previousBest"] ?? 0),
      unit: o["unit"] === "seconds" ? ("seconds" as const) : ("reps" as const),
    };
  })
  .handler(async ({ data, context }): Promise<PlateauAdvice> => {
    const { supabase, userId } = context;
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

    // Cache: gab es fuer diesen Skill schon einen Rat diese Woche?
    const { data: existing } = await supabase
      .from("coach_advice")
      .select("advice")
      .eq("user_id", userId)
      .gte("created_at", weekAgo)
      .contains("plan", { plateau_skill: data.skillId })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing?.advice) return { advice: existing.advice, cached: true };

    const unitLabel = data.unit === "seconds" ? "Sekunden" : "Wiederholungen";
    const fallback = `Plateau bei ${data.skillName}: Reduziere das Volumen um ca. 30 % und arbeite 1–2 Wochen mit der leichteren Progressionsstufe bei hoeherem Volumen. Achte auf 30 Min. mehr Schlaf und laengere Pausen (2–3 Min.) zwischen den Saetzen.`;

    let advice = fallback;
    const key = process.env["LOVABLE_API_KEY"];
    if (key) {
      try {
        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "content-type": "application/json", "Lovable-API-Key": key },
          body: JSON.stringify({
            model: MODEL,
            messages: [
              {
                role: "user",
                content: `Du bist ein Calisthenics-Coach. Ein Athlet stagniert bei "${data.skillName}" seit 2 Wochen (Bestwert ${data.previousBest} -> ${data.recentBest} ${unitLabel}, trotz regelmaessigem Training).
Gib 2-3 konkrete, umsetzbare Empfehlungen auf Deutsch (max. 60 Woerter): Volumen/Intensitaet anpassen, Progressionsstufe wechseln, Schlaf/Ernaehrung, Pausen. Kein Motivationsbla, nur Handlungen.`,
              },
            ],
          }),
        });
        if (res.ok) {
          const json = (await res.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
          };
          const text = json.choices?.[0]?.message?.content?.trim();
          if (text) advice = text.slice(0, 600);
        }
      } catch {
        /* Fallback bleibt */
      }
    }

    await supabase.from("coach_advice").insert({
      user_id: userId,
      advice,
      plan: { plateau_skill: data.skillId, recent_best: data.recentBest, previous_best: data.previousBest },
      model: MODEL,
    });

    return { advice, cached: false };
  });
