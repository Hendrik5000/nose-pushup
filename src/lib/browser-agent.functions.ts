import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { fetchBrowserAgentPage, type BrowserAgentPage } from "./browser-agent.server";

const browserAgentRequestSchema = z.object({ url: z.string().min(4).max(2048) }).strict();

export const fetchMiraBrowserPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value) => browserAgentRequestSchema.parse(value))
  .handler(async ({ data }): Promise<BrowserAgentPage> => {
    setResponseHeader("Cache-Control", "no-store");
    setResponseHeader("X-Content-Type-Options", "nosniff");
    return fetchBrowserAgentPage(data.url);
  });
