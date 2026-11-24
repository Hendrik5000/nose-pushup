import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import gridDefenseDocument from "../../private-game-preview/grid-defense.html?raw";
import kupferkernDocument from "../../private-game-preview/kupferkern.html?raw";
import neonStarfighterDocument from "../../private-game-preview/neon-starfighter.html?raw";
import chessDocument from "../../private-game-preview/chess.html?raw";
import { setResponseHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PRIVATE_GAME_IDS, withAdminGameAccess } from "@/lib/private-game-policy";

const gameRequestSchema = z.object({ game: z.enum(PRIVATE_GAME_IDS) }).strict();

const privateGameDocuments = {
  "grid-defense": gridDefenseDocument,
  kupferkern: kupferkernDocument,
  "neon-starfighter": neonStarfighterDocument,
  chess: chessDocument,
} satisfies Record<(typeof PRIVATE_GAME_IDS)[number], string>;

export const getPrivateGameDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value) => gameRequestSchema.parse(value))
  .handler(async ({ data, context }) => {
    setResponseHeader("Cache-Control", "private, no-store");
    setResponseHeader("X-Content-Type-Options", "nosniff");
    return withAdminGameAccess(
      context.claims.is_anonymous,
      async () =>
        await context.supabase.rpc("has_global_role" as never, { p_role_name: "admin" } as never),
      () => privateGameDocuments[data.game],
    );
  });
