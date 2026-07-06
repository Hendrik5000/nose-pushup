import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "log_workout",
  title: "Log a workout",
  description:
    "Log a completed workout for the signed-in user. Triggers XP, streak, personal-best, and challenge progress updates server-side. Exercise ids include 'pushup', 'squat', 'plank', 'burpee'.",
  inputSchema: {
    exercise_id: z.string().describe("Exercise id, e.g. 'pushup', 'squat', 'plank', 'burpee'."),
    count: z.number().int().describe("Rep count (0-1000). For 'plank', pass 0 and use duration_ms."),
    duration_ms: z
      .number()
      .int()
      .describe("Session duration in milliseconds. Required for 'plank'; use 0 otherwise.")
      .optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ exercise_id, count, duration_ms }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    if (count < 0 || count > 1000) {
      return { content: [{ type: "text", text: "count must be between 0 and 1000" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("workouts")
      .insert({
        user_id: ctx.getUserId(),
        exercise_id,
        count,
        duration_ms: duration_ms ?? 0,
      })
      .select("id, exercise_id, count, duration_ms, created_at")
      .maybeSingle();
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: `Logged: ${JSON.stringify(data)}` }],
      structuredContent: { workout: data },
    };
  },
});
