import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import gridDefenseDocument from "../../private-game-preview/grid-defense.html?raw";
import kupferkernDocument from "../../private-game-preview/kupferkern.html?raw";
import {
  PUBLIC_GAME_IDS,
  resolvePublicGameDocument,
  type PublicGameId,
} from "@/lib/public-game-policy";

const publicGameRequestSchema = z.object({ game: z.enum(PUBLIC_GAME_IDS) }).strict();

const publicGameDocuments = {
  "grid-defense": gridDefenseDocument,
  kupferkern: kupferkernDocument,
} satisfies Record<PublicGameId, string>;

export const getPublicGameDocument = createServerFn({ method: "POST" })
  .validator((value) => publicGameRequestSchema.parse(value))
  .handler(({ data }) => {
    setResponseHeader("Cache-Control", "no-store");
    setResponseHeader("X-Content-Type-Options", "nosniff");
    return resolvePublicGameDocument(data.game, publicGameDocuments);
  });
