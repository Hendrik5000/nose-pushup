export const PRIVATE_GAME_IDS = ["grid-defense", "kupferkern"] as const;

export type PrivateGameId = (typeof PRIVATE_GAME_IDS)[number];

type AdminRoleResult = { data: unknown; error: unknown };

export async function withAdminGameAccess<T>(
  isAnonymousClaim: unknown,
  checkAdminRole: () => Promise<AdminRoleResult>,
  loadPrivateDocument: () => T | Promise<T>,
): Promise<T> {
  if (isAnonymousClaim === true || isAnonymousClaim === "true") {
    throw new Error("Not authorized");
  }

  let roleResult: AdminRoleResult;
  try {
    roleResult = await checkAdminRole();
  } catch {
    throw new Error("Not authorized");
  }

  if (roleResult.error || roleResult.data !== true) {
    throw new Error("Not authorized");
  }

  return loadPrivateDocument();
}
