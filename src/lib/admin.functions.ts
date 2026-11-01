import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { canManageGlobalRoles, isValidAdminTargetUserId } from "@/lib/admin-policy";

function isAnonymousClaim(value: unknown): boolean {
  return value === true || value === "true";
}

export type AdminRoleAssignment = {
  userId: string;
  grantedAt: string;
  canRevoke: boolean;
};

export type AdminRoleManagementResult =
  { canManage: false; assignments: [] } | { canManage: true; assignments: AdminRoleAssignment[] };

export const getAdminAreaAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (isAnonymousClaim(context.claims.is_anonymous)) return false;

    const { data, error } = await context.supabase.rpc(
      "has_global_role" as never,
      { p_role_name: "admin" } as never,
    );
    return !error && data === true;
  });

export const getAdminRoleManagement = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminRoleManagementResult> => {
    if (!canManageGlobalRoles(context.userId, isAnonymousClaim(context.claims.is_anonymous))) {
      return { canManage: false, assignments: [] };
    }

    const { data, error } = await context.supabase.rpc(
      "list_admin_role_assignments" as never,
      {} as never,
    );
    if (error || !Array.isArray(data)) throw new Error("Admin role list unavailable");
    const rows: unknown[] = data;

    const assignments = rows.flatMap((entry: unknown) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
      const row = entry as Record<string, unknown>;
      if (!isValidAdminTargetUserId(row.user_id) || typeof row.granted_at !== "string") {
        return [];
      }
      const grantedAt = new Date(row.granted_at);
      if (Number.isNaN(grantedAt.getTime())) return [];
      return [
        {
          userId: row.user_id,
          grantedAt: grantedAt.toISOString(),
          canRevoke: row.user_id !== context.userId,
        },
      ];
    });

    return { canManage: true, assignments };
  });

export const grantAdminAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value) => {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      Object.keys(value).length !== 1 ||
      !isValidAdminTargetUserId((value as Record<string, unknown>).userId)
    ) {
      throw new Error("Invalid request");
    }
    return { userId: (value as { userId: string }).userId };
  })
  .handler(async ({ data, context }) => {
    if (!canManageGlobalRoles(context.userId, isAnonymousClaim(context.claims.is_anonymous))) {
      throw new Error("Not authorized");
    }
    const { error } = await context.supabase.rpc(
      "grant_global_role" as never,
      { p_user_id: data.userId, p_role_name: "admin" } as never,
    );
    if (error) throw new Error("Admin role operation failed");
    return { ok: true };
  });

export const revokeAdminAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value) => {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      Object.keys(value).length !== 1 ||
      !isValidAdminTargetUserId((value as Record<string, unknown>).userId)
    ) {
      throw new Error("Invalid request");
    }
    return { userId: (value as { userId: string }).userId };
  })
  .handler(async ({ data, context }) => {
    if (!canManageGlobalRoles(context.userId, isAnonymousClaim(context.claims.is_anonymous))) {
      throw new Error("Not authorized");
    }
    const { error } = await context.supabase.rpc(
      "revoke_global_role" as never,
      { p_user_id: data.userId, p_role_name: "admin" } as never,
    );
    if (error) throw new Error("Admin role operation failed");
    return { ok: true };
  });
