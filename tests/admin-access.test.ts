import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  ADMIN_ROLE_MANAGER_USER_ID,
  canManageGlobalRoles,
  isValidAdminTargetUserId,
} from "../src/lib/admin-policy";

const root = process.cwd();
const home = readFileSync(resolve(root, "src/routes/_authenticated/index.tsx"), "utf8");
const route = readFileSync(resolve(root, "src/routes/_authenticated/admin.tsx"), "utf8");
const marketplaceRoute = readFileSync(
  resolve(root, "src/routes/_authenticated/marketplace.tsx"),
  "utf8",
);
const functions = readFileSync(resolve(root, "src/lib/admin.functions.ts"), "utf8");
const migrations = readdirSync(resolve(root, "supabase/migrations"));
const schemaPath = migrations.find((name) => name.endsWith("_global_admin_roles.sql"));
const seedPath = migrations.find((name) => name.endsWith("_seed_initial_admin_roles.sql"));
const listingPath = migrations.find((name) => name.endsWith("_admin_role_listing.sql"));
assert.ok(schemaPath, "Admin role schema migration should exist");
assert.ok(seedPath, "Initial Admin role seed migration should exist");
assert.ok(listingPath, "Owner-only role listing migration should exist");
const schema = readFileSync(resolve(root, "supabase/migrations", schemaPath), "utf8");
const seed = readFileSync(resolve(root, "supabase/migrations", seedPath), "utf8");
const listing = readFileSync(resolve(root, "supabase/migrations", listingPath), "utf8");

test("only the server-verified owner identity may manage global roles", () => {
  assert.equal(ADMIN_ROLE_MANAGER_USER_ID, "fb92aeaf-8e01-4aa5-b1ce-2ffb6915e78c");
  assert.equal(canManageGlobalRoles(ADMIN_ROLE_MANAGER_USER_ID, false), true);
  assert.equal(canManageGlobalRoles("0c580e34-a3fd-4079-8c32-7624f699623a", false), false);
  assert.equal(canManageGlobalRoles("0c580e34-a3fd-4079-8c32-7624f699623a", true), false);
  assert.equal(isValidAdminTargetUserId("0c580e34-a3fd-4079-8c32-7624f699623a"), true);
  assert.equal(isValidAdminTargetUserId("not-a-user-id"), false);
});

test("Admin tile is rendered only after the server-side access function returns true", () => {
  assert.match(home, /getAdminAreaAccess\(\)/);
  assert.match(home, /canSeeAdmin\s*&&\s*<HubAppIcon to="\/admin" title="Admin" artwork="admin"/);
  assert.match(
    home,
    /canSeeAdmin\s*&&\s*<HubAppIcon to="\/marketplace" title="Marketplace" artwork="marketplace" \/>/,
  );
  assert.match(
    home,
    /type HubArtworkKind =[\s\S]*?"admin"[\s\S]*?"gridDefense"[\s\S]*?"kupferkern"/,
  );
  assert.match(route, /beforeLoad:[\s\S]*?getAdminAreaAccess\(\)[\s\S]*?redirect\(\{\s*to:\s*"\/"/);
  assert.match(
    marketplaceRoute,
    /beforeLoad:[\s\S]*?getAdminAreaAccess\(\)[\s\S]*?redirect\(\{\s*to:\s*"\/"/,
  );
  assert.doesNotMatch(
    marketplaceRoute,
    /ADMIN_ROLE_MANAGER_USER_ID|canManageGlobalRoles|grantAdminAccess|revokeAdminAccess|Hendrik|Jan/i,
  );
});

test("Marketplace reuses the read-only generic Admin role RPC, not role-management authority", () => {
  const accessCheckStart = functions.indexOf("export const getAdminAreaAccess");
  const accessCheckEnd = functions.indexOf("export const getAdminRoleManagement");
  assert.ok(accessCheckStart >= 0 && accessCheckEnd > accessCheckStart);
  const accessCheck = functions.slice(accessCheckStart, accessCheckEnd);
  assert.match(accessCheck, /requireSupabaseAuth/);
  assert.match(accessCheck, /has_global_role/);
  assert.match(accessCheck, /p_role_name:\s*"admin"/);
  assert.match(accessCheck, /!error\s*&&\s*data\s*===\s*true/);
  assert.doesNotMatch(
    accessCheck,
    /grant_global_role|revoke_global_role|list_admin_role_assignments/,
  );
});

test("only the role manager receives the role list and sees management controls", () => {
  assert.match(functions, /getAdminRoleManagement = createServerFn/);
  assert.match(
    functions,
    /if \(!canManageGlobalRoles\(context\.userId,[\s\S]+?canManage: false, assignments: \[\]/,
  );
  assert.match(functions, /list_admin_role_assignments/);
  assert.match(route, /roleAccess\?\.canManage\s*&&/);
  assert.match(route, /grantAdminAccess\(\{ data: \{ userId:/);
  assert.match(route, /revokeAdminAccess\(\{ data: \{ userId \}/);
  assert.match(route, /assignment\.canRevoke/);
});

test("server functions use verified auth context and never accept caller role claims", () => {
  assert.match(functions, /\.middleware\(\[requireSupabaseAuth\]\)/);
  assert.match(functions, /context\.userId/);
  assert.match(functions, /context\.claims\.is_anonymous/);
  assert.match(functions, /has_global_role/);
  assert.match(functions, /grant_global_role/);
  assert.match(functions, /revoke_global_role/);
  assert.doesNotMatch(functions, /data\.(role|isAdmin|is_admin)|claims\.(role|app_metadata)/i);
});

test("role assignments are not directly readable/writable and mutations use database-verified identity", () => {
  assert.match(schema, /ALTER TABLE public\.global_role_assignments ENABLE ROW LEVEL SECURITY/);
  assert.match(
    schema,
    /REVOKE ALL ON public\.global_role_assignments FROM PUBLIC, anon, authenticated, service_role/,
  );
  assert.doesNotMatch(schema, /CREATE POLICY[^;]+ON public\.global_role_assignments/i);
  assert.match(schema, /assignment\.user_id\s*=\s*\(SELECT auth\.uid\(\)\)/);
  assert.equal(
    (schema.match(/auth\.uid\(\)\) IS DISTINCT FROM 'fb92aeaf-8e01-4aa5-b1ce-2ffb6915e78c'/g) ?? [])
      .length,
    2,
  );
  assert.match(schema, /The role authority cannot revoke its own admin role/);
  assert.match(
    schema,
    /REVOKE ALL ON FUNCTION public\.grant_global_role\(UUID, TEXT\) FROM PUBLIC, anon, service_role/,
  );
  assert.match(
    schema,
    /GRANT EXECUTE ON FUNCTION public\.grant_global_role\(UUID, TEXT\) TO authenticated/,
  );
  assert.match(
    schema,
    /REVOKE ALL ON FUNCTION public\.revoke_global_role\(UUID, TEXT\) FROM PUBLIC, anon, service_role/,
  );
  assert.match(
    schema,
    /GRANT EXECUTE ON FUNCTION public\.revoke_global_role\(UUID, TEXT\) TO authenticated/,
  );
});

test("role listing RPC is database-verified, owner-only and reveals only Admin assignments", () => {
  assert.match(listing, /CREATE OR REPLACE FUNCTION public\.list_admin_role_assignments\(\)/);
  assert.match(listing, /RETURNS TABLE \(user_id UUID, granted_at TIMESTAMPTZ\)/);
  assert.match(listing, /SECURITY DEFINER[\s\S]+?SET search_path = ''/);
  assert.match(listing, /auth\.uid\(\)\) IS DISTINCT FROM 'fb92aeaf-8e01-4aa5-b1ce-2ffb6915e78c'/);
  assert.match(listing, /WHERE assignment\.role_name = 'admin'/);
  assert.match(
    listing,
    /REVOKE ALL ON FUNCTION public\.list_admin_role_assignments\(\) FROM PUBLIC, anon, service_role/,
  );
  assert.match(
    listing,
    /GRANT EXECUTE ON FUNCTION public\.list_admin_role_assignments\(\) TO authenticated/,
  );
  assert.doesNotMatch(listing, /health|chat|mira/i);
});

test("seed verifies both current profiles before any assignment and grants Jan no role-management authority", () => {
  const preflight = seed.indexOf("DO $admin_seed_preflight$");
  const assignment = seed.indexOf("INSERT INTO public.global_role_assignments");
  assert.ok(preflight >= 0 && assignment > preflight);
  assert.match(seed, /SELECT count\(\*\)[\s\S]+FROM public\.profiles/);
  assert.match(seed, /IF matching_profiles <> 2 THEN[\s\S]+RAISE EXCEPTION/);
  assert.match(seed, /fb92aeaf-8e01-4aa5-b1ce-2ffb6915e78c/);
  assert.match(seed, /0c580e34-a3fd-4079-8c32-7624f699623a/);
  assert.match(
    seed,
    /'0c580e34-a3fd-4079-8c32-7624f699623a'::UUID, 'admin', 'fb92aeaf-8e01-4aa5-b1ce-2ffb6915e78c'::UUID/,
  );
  assert.equal((seed.match(/'admin'/g) ?? []).length, 2);
});
