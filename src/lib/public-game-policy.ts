export const PUBLIC_GAME_IDS = ["grid-defense", "kupferkern"] as const;
export type PublicGameId = (typeof PUBLIC_GAME_IDS)[number];

export function isPublicGameId(value: unknown): value is PublicGameId {
  return typeof value === "string" && PUBLIC_GAME_IDS.includes(value as PublicGameId);
}

export function resolvePublicGameDocument<T>(
  game: unknown,
  documents: Readonly<Record<PublicGameId, T>>,
): T {
  if (!isPublicGameId(game)) throw new Error("Unknown game");
  return documents[game];
}
