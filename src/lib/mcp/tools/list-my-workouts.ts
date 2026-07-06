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
  name: "list_my_workouts",
  title: "List my workouts",
  description:
    "List the signed-in user's most recent workouts (exercise id, rep count, duration in ms, created_at). Newest first.",
  inputSchema: {
    limit: z
      .number()
      .int()
      .describe("Maximum workouts to return (1-100). Defaults to 20.")
      .optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const capped = Math.min(100, Math.max(1, limit ?? 20));
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("workouts")
      .select("id, exercise_id, count, duration_ms, created_at")
      .eq("user_id", ctx.getUserId())
      .order("created_at", { ascending: false })
      .limit(capped);
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { workouts: data ?? [] },
    };
  },
});
