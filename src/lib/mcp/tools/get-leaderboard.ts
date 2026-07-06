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
  name: "get_my_recent_stats",
  title: "Get my recent daily stats",
  description:
    "Return the signed-in user's daily aggregates (total reps, sessions, total duration) for the last N days. Newest first.",
  inputSchema: {
    days: z.number().int().describe("Number of days back to fetch (1-90). Defaults to 14.").optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ days }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const capped = Math.min(90, Math.max(1, days ?? 14));
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("daily_stats")
      .select("day, total_reps, sessions, total_duration_ms")
      .eq("user_id", ctx.getUserId())
      .order("day", { ascending: false })
      .limit(capped);
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { daily_stats: data ?? [] },
    };
  },
});
