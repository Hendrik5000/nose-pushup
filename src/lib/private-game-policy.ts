export const PRIVATE_GAME_IDS = [
  "grid-defense",
  "kupferkern",
  "neon-starfighter",
  "chess",
] as const;

export type PrivateGameId = (typeof PRIVATE_GAME_IDS)[number];

export async function withAuthenticatedGameAccess<T>(
  isAnonymousClaim: unknown,
  loadPrivateDocument: () => T | Promise<T>,
): Promise<T> {
  if (isAnonymousClaim === true || isAnonymousClaim === "true") {
    throw new Error("Not authorized");
  }

  return loadPrivateDocument();
}
