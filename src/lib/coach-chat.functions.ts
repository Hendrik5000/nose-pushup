import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MODEL = "google/gemini-3-flash-preview";
const MAX_TOOL_ROUNDS = 5;

type ChatMessage = { role: "system" | "user" | "assistant" | "tool"; content: string; tool_call_id?: string; tool_calls?: unknown };
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
          count: { type: "integer", description: "Reps (for plank: seconds). 1–500.", minimum: 1, maximum: 500 },
          duration_s: { type: "integer", description: "Optional duration in seconds (0–3600).", minimum: 0, maximum: 3600 },
        },
        required: ["exercise_id", "count"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_recent_stats",
      description: "Fetch the user's daily rep totals for the last N days (max 30). Use when the user asks about progress, week/month totals, or trends.",
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
    const text = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("Rate limit — bitte kurz warten.");
    if (res.status === 402) throw new Error("AI-Kredit aufgebraucht. Bitte im Workspace aufladen.");
    throw new Error(`AI-Fehler ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as {
    choices: Array<{
      message: {
        role: "assistant";
        content: string | null;
        tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
      };
    }>;
  };
}

export const coachChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const raw = (input ?? {}) as { messages?: InMsg[] };
    const messages = Array.isArray(raw.messages) ? raw.messages : [];
    const cleaned: InMsg[] = messages
      .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-20)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
    if (cleaned.length === 0) throw new Error("Keine Nachricht");
    return { messages: cleaned };
  })
  .handler(async ({ data, context }): Promise<{ reply: string; actions: string[] }> => {
    const { supabase, userId } = context;
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI ist gerade nicht verfügbar (Konfiguration fehlt).");

    // Gather context for system prompt.
    const cutoff = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
    const [{ data: profile }, { data: stats }] = await Promise.all([
      supabase
        .from("profiles")
        .select("display_name, level, xp, current_streak, longest_streak, best_count, personal_bests, last_workout_date")
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
    const weekReps = days.filter((d) => +new Date(d.day) >= Date.now() - 7 * 86400000).reduce((s, d) => s + d.total_reps, 0);
    const name = (profile?.display_name as string | null) ?? "Athlet";

    const system = `Du bist "Smart Coach", ein autonomer, motivierender deutschsprachiger Fitness-Coach in der Nose-Push-Up App. Du kennst Trainingslehre, Kraftaufbau, Muskelgruppen, Ernährung und Regeneration.

STIL: Knapp, direkt, motivierend. Antworten meist 2–5 Sätze. Kein Fachchinesisch außer der Nutzer fragt.

NUTZER-KONTEXT:
- Name: ${name}
- Level: ${profile?.level ?? 1}, XP: ${profile?.xp ?? 0}
- Aktuelle Streak: ${profile?.current_streak ?? 0} Tage (längste: ${profile?.longest_streak ?? 0})
- Push-Up Bestwert: ${profile?.best_count ?? 0}
- Personal Bests: ${JSON.stringify(profile?.personal_bests ?? {})}
- Reps letzte 7 Tage: ${weekReps}
- Letztes Training: ${profile?.last_workout_date ?? "nie"}

TOOL-NUTZUNG (WICHTIG):
- Sagt der Nutzer sinngemäß "ich habe X gemacht/geschafft/absolviert" → RUFE SOFORT log_workout AUF. Nicht nachfragen, direkt loggen.
- Fragt der Nutzer nach Fortschritt/Statistik/Woche → get_recent_stats.
- Erklärungen, Tipps, Trainingspläne, Muskelaufbau-Fragen: einfach antworten, ohne Tool.

Nach einem log_workout: kurze Bestätigung + Motivation (z.B. "10 Klimmzüge geloggt 💪 XP wandert automatisch rein — gutes Set!"). Erwähne wenn ein neuer PB.

Wenn der Nutzer nach Muskelwachstum/Verbesserung fragt: konkrete Trainingsempfehlungen (Sätze × Wiederholungen), Progression, Regenerationstipps.`;

    const gwMessages: ChatMessage[] = [
      { role: "system", content: system },
      ...data.messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const actions: string[] = [];

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const json = await callGateway(key, gwMessages);
      const msg = json.choices?.[0]?.message;
      if (!msg) throw new Error("Leere Antwort vom Modell");

      const toolCalls = msg.tool_calls ?? [];
      if (toolCalls.length === 0) {
        return { reply: (msg.content ?? "").trim() || "…", actions };
      }

      gwMessages.push({
        role: "assistant",
        content: msg.content ?? "",
        tool_calls: toolCalls,
      });

      for (const tc of toolCalls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function.arguments || "{}");
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
      reply: "Ich habe zu viele Aktionen hintereinander gebraucht — versuch die Frage nochmal etwas kürzer.",
      actions,
    };
  });

async function runTool(
  name: string,
  args: Record<string, unknown>,
  ctx: { supabase: ReturnType<typeof requireSupabaseAuth extends never ? never : never> | any; userId: string },
): Promise<{ data: unknown; action?: string }> {
  const supabase = ctx.supabase;
  const userId = ctx.userId;

  if (name === "log_workout") {
    const rawId = String(args.exercise_id ?? "pushup").toLowerCase();
    const exercise_id = KNOWN_EXERCISES.has(rawId) ? rawId : "pushup";
    const count = Math.max(1, Math.min(500, Number(args.count) | 0));
    const duration_ms = Math.max(0, Math.min(3600000, ((Number(args.duration_s) | 0) * 1000)));
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
