/** The only verified account allowed to grant or revoke global roles. */
export const ADMIN_ROLE_MANAGER_USER_ID = "fb92aeaf-8e01-4aa5-b1ce-2ffb6915e78c";

/** Treat only a verified Supabase identity as an authority; never inspect client role claims. */
export function canManageGlobalRoles(verifiedUserId: string, isAnonymous: boolean): boolean {
  return !isAnonymous && verifiedUserId === ADMIN_ROLE_MANAGER_USER_ID;
}

export function isValidAdminTargetUserId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}
