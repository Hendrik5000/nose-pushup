import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MODEL = "google/gemini-3-flash-preview";
const MAX_TOOL_ROUNDS = 5;

type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  tool_calls?: unknown;
};
type InMsg = { role: "user" | "assistant"; content: string };

const TOOLS = [
  {
    type: "function",
    function: {
      name: "log_workout",
      description:
        "Log a completed workout for the current user. Use when the user reports they finished an exercise (e.g. 'ich habe 10 Klimmzüge gemacht', 'gerade 20 Push-Ups').",
      parameters: {
        type: "object",
        properties: {
          exercise_id: {
            type: "string",
            description: "Exercise id. One of: pushup, situp, squat, plank, burpee, pullup, other.",
          },
          count: {
            type: "integer",
            description: "Reps (for plank: seconds). 1–500.",
            minimum: 1,
            maximum: 500,
          },
          duration_s: {
            type: "integer",
            description: "Optional duration in seconds (0–3600).",
            minimum: 0,
            maximum: 3600,
          },
        },
        required: ["exercise_id", "count"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_recent_stats",
      description:
        "Fetch the user's daily rep totals for the last N days (max 30). Use when the user asks about progress, week/month totals, or trends.",
      parameters: {
        type: "object",
        properties: { days: { type: "integer", minimum: 1, maximum: 30 } },
        required: ["days"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_workouts",
      description: "List the user's most recent workout entries (max 20).",
      parameters: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 20 } },
        required: ["limit"],
      },
    },
  },
] as const;

const KNOWN_EXERCISES = new Set(["pushup", "situp", "squat", "plank", "burpee"]);

async function callGateway(key: string, messages: ChatMessage[]) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({ model: MODEL, messages, tools: TOOLS, tool_choice: "auto" }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Coach-Gateway ${res.status}: ${t.slice(0, 200)}`);
  }
  return (await res.json()) as {
    choices?: {
      message?: {
        role: "assistant";
        content?: string | null;
        tool_calls?: {
          id: string;
          type: "function";
          function: { name: string; arguments: string };
        }[];
      };
    }[];
  };
}

export const coachChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const raw = (input ?? {}) as { messages?: InMsg[] };
    const messages = Array.isArray(raw.messages) ? raw.messages : [];
    // Security: never accept assistant/system roles from the client (prompt injection).
    const cleaned: InMsg[] = messages
      .filter((m) => m.role === "user" && typeof m.content === "string")
      .slice(-12)
      .map((m) => ({ role: "user" as const, content: m.content.slice(0, 4000) }));
    if (cleaned.length === 0) throw new Error("Keine Nachricht");
    return { messages: cleaned };
  })
  .handler(async ({ data, context }): Promise<{ reply: string; actions: string[] }> => {
    const { supabase, userId } = context;
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI ist gerade nicht verfügbar (Konfiguration fehlt).");

    const cutoff = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
    const [{ data: profile }, { data: recentStats }, { data: runs }, { data: health }] =
      await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase
          .from("daily_stats")
          .select("day, total_reps, sessions")
          .eq("user_id", userId)
          .gte("day", cutoff)
          .order("day", { ascending: false })
          .limit(14),
        supabase
          .from("runs")
          .select("distance_m, duration_ms, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("health_entries")
          .select("day, steps, sleep_min, active_kcal")
          .eq("user_id", userId)
          .order("day", { ascending: false })
          .limit(7),
      ]);

    const name = (profile as { display_name?: string } | null)?.display_name ?? "Sportler";
    const age = (profile as { birth_year?: number } | null)?.birth_year
      ? new Date().getFullYear() - Number((profile as { birth_year: number }).birth_year)
      : null;
    const h = (profile as { height_cm?: number } | null)?.height_cm;
    const w = (profile as { weight_kg?: number } | null)?.weight_kg;
    const bmi = h && w ? (Number(w) / (Number(h) / 100) ** 2).toFixed(1) : null;
    const weekReps = (recentStats ?? []).reduce(
      (n: number, r: { total_reps?: number }) => n + (r.total_reps ?? 0),
      0,
    );
    const runEntries = runs ?? [];
    const runSummary = runEntries.length
      ? runEntries
          .map(
            (r) =>
              `${(r.distance_m / 1000).toFixed(1)} km in ${Math.round(r.duration_ms / 60000)} min`,
          )
          .join("; ")
      : "keine Läufe";
    const healthEntries = health ?? [];
    const healthSummary = healthEntries.length
      ? healthEntries
          .map(
            (e) =>
              `${e.day}: ${e.steps ?? "?"} Schritte, ${e.sleep_min != null ? (e.sleep_min / 60).toFixed(1) : "?"} h Schlaf, ${e.active_kcal ?? "?"} kcal`,
          )
          .join("; ")
      : "keine Health-Daten";

    const system = `Du bist "Smart Coach", ein autonomer, motivierender deutschsprachiger Fitness-Coach in der Nose-Push-Up App. Du kennst Trainingslehre, Kraftaufbau, Muskelgruppen, Ernährung und Regeneration.

STIL: Knapp, direkt, motivierend. Antworten meist 2–5 Sätze. Kein Fachchinesisch außer der Nutzer fragt.

NUTZER-KONTEXT:
- Name: ${name}
- Alter: ${age ?? "unbekannt"}, Größe: ${h ?? "unbekannt"} cm, Gewicht: ${w ?? "unbekannt"} kg, Geschlecht: ${(profile as { sex?: string } | null)?.sex ?? "unbekannt"}${bmi ? `, BMI: ${bmi}` : ""}
- Tagesziel: ${(profile as { daily_goal?: number } | null)?.daily_goal ?? 50} Reps
- Level: ${(profile as { level?: number } | null)?.level ?? 1}, XP: ${(profile as { xp?: number } | null)?.xp ?? 0}
- Aktuelle Streak: ${(profile as { current_streak?: number } | null)?.current_streak ?? 0} Tage
- Push-Up Bestwert: ${(profile as { best_count?: number } | null)?.best_count ?? 0}
- Reps letzte 14 Tage: ${weekReps}
- Letzte Läufe: ${runSummary}
- Health-Daten: ${healthSummary}

TOOL-NUTZUNG:
- Sagt der Nutzer sinngemäß "ich habe X gemacht" → RUFE SOFORT log_workout AUF.
- Fragt nach Fortschritt → get_recent_stats / get_workouts.
- Sonst normal antworten.`;

    const gwMessages: ChatMessage[] = [
      { role: "system", content: system },
      ...data.messages.map((m) => ({ role: m.role as "user", content: m.content })),
    ];

    const actions: string[] = [];

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const json = await callGateway(key, gwMessages);
      const msg = json.choices?.[0]?.message;
      if (!msg) throw new Error("Leere Antwort vom Modell");

      if (!msg.tool_calls?.length) {
        return { reply: (msg.content ?? "").trim() || "Alles klar.", actions };
      }

      gwMessages.push({
        role: "assistant",
        content: msg.content ?? "",
        tool_calls: msg.tool_calls,
      });

      for (const tc of msg.tool_calls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function.arguments || "{}") as Record<string, unknown>;
        } catch {
          args = {};
        }
        const result = await runTool(tc.function.name, args, { supabase, userId });
        if (result.action) actions.push(result.action);
        gwMessages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(result.data),
        });
      }
    }

    return {
      reply:
        "Ich habe zu viele Aktionen hintereinander gebraucht — versuch die Frage nochmal etwas kürzer.",
      actions,
    };
  });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupaClient = any;

async function runTool(
  name: string,
  args: Record<string, unknown>,
  ctx: { supabase: SupaClient; userId: string },
): Promise<{ data: unknown; action?: string }> {
  const supabase = ctx.supabase;
  const userId = ctx.userId;

  if (name === "log_workout") {
    const rawId = String(args.exercise_id ?? "pushup").toLowerCase();
    const exercise_id = KNOWN_EXERCISES.has(rawId) ? rawId : "pushup";
    const count = Math.max(1, Math.min(500, Number(args.count) | 0));
    const duration_ms = Math.max(0, Math.min(3600000, (Number(args.duration_s) | 0) * 1000));
    const { error } = await supabase
      .from("workouts")
      .insert({ user_id: userId, exercise_id, count, duration_ms });
    if (error) return { data: { ok: false, error: error.message } };
    return {
      data: { ok: true, exercise_id, count, duration_s: duration_ms / 1000 },
      action: `Geloggt: ${count} × ${exercise_id}`,
    };
  }

  if (name === "get_recent_stats") {
    const days = Math.max(1, Math.min(30, Number(args.days ?? 7) | 0));
    const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("daily_stats")
      .select("day, total_reps, sessions, total_duration_ms")
      .eq("user_id", userId)
      .gte("day", cutoff)
      .order("day", { ascending: true });
    if (error) return { data: { ok: false, error: error.message } };
    return { data: { ok: true, days: data ?? [] } };
  }

  if (name === "get_workouts") {
    const limit = Math.max(1, Math.min(20, Number(args.limit ?? 10) | 0));
    const { data, error } = await supabase
      .from("workouts")
      .select("exercise_id, count, duration_ms, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return { data: { ok: false, error: error.message } };
    return { data: { ok: true, workouts: data ?? [] } };
  }

  return { data: { ok: false, error: `Unknown tool: ${name}` } };
}
