import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const battle = read("src/lib/battle.functions.ts");
const migration = read("supabase/migrations/20261102140000_invitation_join_security.sql");
const types = read("src/integrations/supabase/types.ts");

const startApp = battle.slice(
  battle.indexOf("export const startBattle"),
  battle.indexOf("export const finishBattle"),
);
const finishApp = battle.slice(battle.indexOf("export const finishBattle"));
const startSql = migration.slice(
  migration.indexOf("CREATE OR REPLACE FUNCTION public.start_battle"),
  migration.indexOf("REVOKE ALL ON FUNCTION public.start_battle"),
);
const finishSql = migration.slice(
  migration.indexOf("CREATE OR REPLACE FUNCTION public.finish_battle"),
  migration.indexOf("REVOKE ALL ON FUNCTION public.finish_battle"),
);

test("battle start uses a host-only, locked RPC instead of direct table updates", () => {
  assert.match(startApp, /\.middleware\(\[requireSupabaseAuth\]\)/);
  assert.match(startApp, /supabase\.rpc\("start_battle"/);
  assert.doesNotMatch(startApp, /\.from\("battles"\)[\s\S]*?\.update\(/);
  assert.match(startSql, /SECURITY DEFINER/);
  assert.match(startSql, /SET search_path = ''/);
  assert.match(startSql, /SELECT auth\.uid\(\)/);
  assert.match(startSql, /FOR UPDATE/);
  assert.match(startSql, /_battle\.host_id IS DISTINCT FROM _user_id/);
  assert.match(startSql, /_battle\.status <> 'waiting'/);
  assert.match(startSql, /_battle\.guest_id IS NULL AND NOT _battle\.is_bot/);
  assert.match(startSql, /UPDATE public\.battles[\s\S]*?SET status = 'active'/);
  assert.match(
    migration,
    /GRANT EXECUTE ON FUNCTION public\.start_battle\(UUID\) TO authenticated/,
  );
});

test("battle finish is participant-only, idempotent and derives online scores from the tap ledger", () => {
  assert.match(finishApp, /\.middleware\(\[requireSupabaseAuth\]\)/);
  assert.match(finishApp, /supabase\.rpc\("finish_battle"/);
  assert.doesNotMatch(finishApp, /\.from\("battles"\)[\s\S]*?\.update\(/);
  assert.doesNotMatch(finishApp, /raw\.host_count|_host_count:/);
  assert.match(finishApp, /winner_id: result\.winner_id/);
  assert.match(finishApp, /host_count: result\.host_count/);
  assert.match(finishApp, /guest_count: result\.guest_count/);

  assert.match(finishSql, /SECURITY DEFINER/);
  assert.match(finishSql, /SET search_path = ''/);
  assert.match(finishSql, /SELECT auth\.uid\(\)/);
  assert.match(finishSql, /FOR UPDATE/);
  assert.match(finishSql, /_user_id IS DISTINCT FROM _battle\.host_id[\s\S]*?_battle\.guest_id/);
  assert.match(
    finishSql,
    /_battle\.status = 'finished'[\s\S]*?RETURN QUERY SELECT _battle\.winner_id/,
  );
  assert.match(finishSql, /_battle\.status <> 'active'/);
  assert.match(finishSql, /SUM\(rep\.count\)[\s\S]*?rep\.user_id = _battle\.host_id/);
  assert.match(finishSql, /SUM\(rep\.count\)[\s\S]*?rep\.user_id = _battle\.guest_id/);
  assert.match(finishSql, /IF _battle\.is_bot THEN[\s\S]*?_guest_count_actual := _guest_count/);
  assert.match(
    finishSql,
    /UPDATE public\.battles[\s\S]*?SET status = 'finished'[\s\S]*?host_count = _host_count[\s\S]*?guest_count = _guest_count_actual[\s\S]*?winner_id = _winner_id/,
  );
  assert.match(
    migration,
    /GRANT EXECUTE ON FUNCTION public\.finish_battle\(UUID, INTEGER\) TO authenticated/,
  );
});

test("authenticated users keep no direct UPDATE grant on battles and RPCs are typed", () => {
  assert.match(migration, /REVOKE UPDATE ON TABLE public\.battles FROM authenticated/);
  assert.match(migration, /REVOKE UPDATE \(guest_id\) ON TABLE public\.battles FROM authenticated/);
  assert.match(
    migration,
    /REVOKE ALL ON FUNCTION public\.start_battle\(UUID\) FROM PUBLIC, anon, service_role/,
  );
  assert.match(
    migration,
    /REVOKE ALL ON FUNCTION public\.finish_battle\(UUID, INTEGER\) FROM PUBLIC, anon, service_role/,
  );
  assert.match(types, /start_battle: \{ Args: \{ _battle_id: string \}; Returns: undefined \}/);
  assert.match(
    types,
    /finish_battle: \{[\s\S]*?_guest_count: number[\s\S]*?winner_id: string \| null/,
  );
});
