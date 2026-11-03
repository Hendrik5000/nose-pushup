import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MODEL = "google/gemini-3-flash-preview";

export type MealEstimate = { title: string; kcal: number; protein_g: number; tip: string };

const clamp = (n: unknown, max: number) =>
  Math.max(0, Math.min(max, Math.round(Number.isFinite(Number(n)) ? Number(n) : 0)));

export const analyzeMeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { image: string }) => {
    if (typeof input?.image !== "string" || !input.image.startsWith("data:image/"))
      throw new Error("Bitte ein Foto wählen.");
    if (input.image.length > 6_000_000) throw new Error("Foto ist zu groß.");
    return input;
  })
  .handler(async ({ data, context }): Promise<MealEstimate> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("KI ist gerade nicht verfügbar.");
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("weight_kg")
      .eq("id", context.userId)
      .maybeSingle();
    const weight = (profile as { weight_kg?: number | null } | null)?.weight_kg;
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: MODEL,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              'Du bist Mira, eine Ernährungshilfe für Kraftsportler. Schätze die Mahlzeit auf dem Foto. Antworte NUR als JSON: {"title": kurzer deutscher Name, "kcal": Zahl, "protein_g": Zahl, "tip": ein freundlicher Satz für Muskelaufbau}. Keine medizinischen Aussagen.' +
              (weight ? ` Körpergewicht: ${weight} kg.` : ""),
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Was ist das und wie viel Energie/Protein hat es ungefähr?" },
              { type: "image_url", image_url: { url: data.image } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      console.error("meal gateway", res.status, await res.text().catch(() => ""));
      throw new Error(res.status === 429 ? "Zu viele Anfragen – kurz warten." : "Analyse fehlgeschlagen.");
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "{}");
    } catch {
      throw new Error("Mira konnte das Foto nicht erkennen.");
    }
    return {
      title: String(parsed.title ?? "Mahlzeit").slice(0, 80),
      kcal: clamp(parsed.kcal, 5000),
      protein_g: clamp(parsed.protein_g, 400),
      tip: String(parsed.tip ?? "").slice(0, 300),
    };
  });
