import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  generateInvitationCode,
  INVITATION_CODE_ALPHABET,
  INVITATION_CODE_LENGTH,
} from "../src/lib/invitation-codes.server";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const battle = read("src/lib/battle.functions.ts");
const club = read("src/lib/club.functions.ts");
const migration = read("supabase/migrations/20261102140000_invitation_join_security.sql");
const battleUi = read("src/routes/_authenticated/battle.index.tsx");
const clubUi = read("src/routes/_authenticated/clubs.tsx");
const generator = read("src/lib/invitation-codes.server.ts");

const battleJoin = battle.slice(
  battle.indexOf("export const joinBattle"),
  battle.indexOf("export const startBattle"),
);
const clubJoin = club.slice(club.indexOf("export const joinClubByCode"));
const battleJoinSql = migration.slice(
  migration.indexOf("CREATE FUNCTION public.join_battle_by_code"),
  migration.indexOf("REVOKE ALL ON FUNCTION public.join_battle_by_code"),
);
const clubJoinSql = migration.slice(
  migration.indexOf("CREATE FUNCTION public.join_club_by_code"),
  migration.indexOf("REVOKE ALL ON FUNCTION public.join_club_by_code"),
);
const limiterSql = migration.slice(
  migration.indexOf("CREATE OR REPLACE FUNCTION public.claim_invitation_join_attempt"),
  migration.indexOf("REVOKE ALL ON FUNCTION public.claim_invitation_join_attempt"),
);

test("invitation codes use a cryptographic source and the full 80-bit format", () => {
  assert.match(generator, /randomBytes\(INVITATION_CODE_LENGTH\)/);
  assert.match(generator, /byte & 31/);
  assert.equal(INVITATION_CODE_LENGTH, 16);
  assert.equal(INVITATION_CODE_ALPHABET.length, 32);

  const generated = new Set<string>();
  for (let i = 0; i < 256; i++) {
    const code = generateInvitationCode();
    assert.match(code, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{16}$/);
    generated.add(code);
  }
  assert.equal(generated.size, 256);
  assert.doesNotMatch(battle, /Math\.random\s*\(/);
  assert.doesNotMatch(club, /Math\.random\s*\(/);
});

test("both code-join server functions require verified auth and call only guarded RPCs", () => {
  assert.match(battleJoin, /\.middleware\(\[requireSupabaseAuth\]\)/);
  assert.match(battleJoin, /supabase\.rpc\([\s\S]*?join_battle_by_code/);
  assert.doesNotMatch(battleJoin, /supabaseAdmin/);
  assert.match(clubJoin, /\.middleware\(\[requireSupabaseAuth\]\)/);
  assert.match(clubJoin, /supabase\.rpc\([\s\S]*?join_club_by_code/);
  assert.match(battleJoin, /\{4,16\}/);
  assert.match(clubJoin, /\{4,16\}/);
  assert.match(battleUi, /maxLength=\{16\}/);
  assert.match(clubUi, /maxLength=\{16\}/);
});

test("database RPCs enforce authentication, code validation and a shared persistent attempt limit", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.invitation_join_limits/);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(
    migration,
    /REVOKE ALL ON TABLE public\.invitation_join_limits FROM PUBLIC, anon, authenticated, service_role/,
  );
  assert.match(limiterSql, /auth\.uid\(\).*?IS NULL/s);
  assert.match(migration, /PRIMARY KEY \(user_id, invitation_kind\)/);
  assert.match(limiterSql, /FOR UPDATE/);
  assert.match(limiterSql, /INTERVAL '1 minute'/);
  assert.match(limiterSql, /_attempt_count >= 8/);
  assert.match(limiterSql, /RAISE EXCEPTION 'Too many invitation attempts/);
  assert.match(limiterSql, /RETURNING TRUE INTO _inserted/);
  assert.match(limiterSql, /IF COALESCE\(_inserted, false\) THEN[\s\S]*?RETURN;/);

  assert.match(battleJoinSql, /auth\.uid\(\).*?IS NULL/s);
  assert.match(battleJoinSql, /PERFORM public\.claim_invitation_join_attempt\('battle'\)/);
  assert.match(battleJoinSql, /RETURN QUERY SELECT FALSE, NULL::UUID, 'not_found'/);
  assert.ok(
    battleJoinSql.indexOf("claim_invitation_join_attempt('battle')") <
      battleJoinSql.indexOf("WHERE battle.code = _normalized_code"),
  );
  assert.match(battleJoinSql, /battle\.status <> 'waiting'/);
  assert.match(battleJoinSql, /battle\.guest_id IS NULL/);

  assert.match(clubJoinSql, /auth\.uid\(\).*?IS NULL/s);
  assert.match(clubJoinSql, /PERFORM public\.claim_invitation_join_attempt\('club'\)/);
  assert.match(clubJoinSql, /RETURN QUERY SELECT FALSE, NULL::UUID, 'not_found'/);
  assert.ok(
    clubJoinSql.indexOf("claim_invitation_join_attempt('club')") <
      clubJoinSql.indexOf("WHERE club.code = _normalized_code"),
  );
  assert.match(clubJoinSql, /FOR UPDATE/);
  assert.match(clubJoinSql, /_member_count >= 30/);
  assert.match(
    migration,
    /GRANT EXECUTE ON FUNCTION public\.join_battle_by_code\(TEXT\) TO authenticated/,
  );
  assert.match(
    migration,
    /GRANT EXECUTE ON FUNCTION public\.join_club_by_code\(TEXT\) TO authenticated/,
  );
  assert.match(
    migration,
    /REVOKE ALL ON FUNCTION public\.join_battle_by_code\(TEXT\) FROM PUBLIC, anon, service_role/,
  );
  assert.match(
    migration,
    /REVOKE ALL ON FUNCTION public\.join_club_by_code\(TEXT\) FROM PUBLIC, anon, service_role/,
  );
});

test("public matchmaking cannot claim invitation-only battles or bypass the join RPC", () => {
  assert.match(migration, /ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false/);
  assert.match(migration, /WHERE battle\.is_public = true/);
  assert.match(migration, /REVOKE UPDATE \(guest_id\) ON TABLE public\.battles FROM authenticated/);
  assert.match(migration, /DROP POLICY IF EXISTS "battles join as guest" ON public\.battles/);
  assert.match(battle, /"claim_public_battle"/);
  assert.match(battle, /is_public: false/);
  assert.match(battle, /is_public: true/);
  assert.doesNotMatch(battle, /\.update\(\{\s*guest_id:/);
});
