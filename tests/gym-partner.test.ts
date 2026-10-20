import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  normalizeGymAlias,
  normalizeGymExercise,
  normalizeGymInviteCode,
  validateGymDay,
  validateGymSetInput,
} from "../src/lib/gym-partner.ts";

const migration = readFileSync(
  new URL("../supabase/migrations/20261020200000_gym_partner.sql", import.meta.url),
  "utf8",
);
const helper = readFileSync(new URL("../src/lib/gym-partner.ts", import.meta.url), "utf8");

test("aliases and exercise labels are trimmed and constrained", () => {
  assert.equal(normalizeGymAlias("  Kira  "), "Kira");
  assert.equal(normalizeGymAlias("a".repeat(40)), "a".repeat(40));
  assert.throws(() => normalizeGymAlias("  "));
  assert.throws(() => normalizeGymAlias("a".repeat(41)));
  assert.throws(() => normalizeGymAlias("bad\nname"));
  assert.equal(normalizeGymExercise("  Push-up  "), "Push-up");
  assert.throws(() => normalizeGymExercise(""));
  assert.throws(() => normalizeGymExercise("x".repeat(81)));
  assert.throws(() => normalizeGymExercise("dead\u007fname"));
});

test("invite code normalization accepts only twelve hexadecimal characters", () => {
  assert.equal(normalizeGymInviteCode(" ab12cd34ef56 "), "AB12CD34EF56");
  assert.throws(() => normalizeGymInviteCode("AB12-CD34"));
  assert.throws(() => normalizeGymInviteCode("ABCDEFGHJKLM"));
  assert.throws(() => normalizeGymInviteCode("12345678901"));
});

test("set input matches the UI bounds and quarter-kilogram steps", () => {
  assert.equal(validateGymSetInput(1, 0), undefined);
  assert.equal(validateGymSetInput(1000, 1000), undefined);
  assert.equal(validateGymSetInput(5, 82.25), undefined);
  for (const [reps, weight] of [
    [0, 10],
    [1001, 10],
    [1.5, 10],
    [5, -0.25],
    [5, 1000.25],
    [5, 82.1],
    [5, Number.NaN],
  ]) {
    assert.throws(() => validateGymSetInput(reps, weight));
  }
});

test("stable browser API wraps the named caller-JWT RPCs without generated DB types", () => {
  for (const name of [
    "getGymSnapshot",
    "createGymSession",
    "joinGymSession",
    "setGymSharing",
    "addGymSet",
    "deleteGymSet",
    "closeGymSession",
    "getGymHistory",
    "getGymVisits",
    "setGymVisit",
    "setGymVisitSharing",
  ])
    assert.match(helper, new RegExp(`function ${name}\\(`));
  assert.match(
    helper,
    /Der Gym-Modus ist vorbereitet, aber die Datenbank-Erweiterung ist noch nicht eingerichtet\./,
  );
  assert.match(helper, /await import\("@\/integrations\/supabase\/client"\)/);
  assert.match(helper, /Promise<GymSet\[]>/);
});

test("SQL denies direct table access and uses RLS plus fixed-path definer RPCs", () => {
  for (const table of [
    "gym_sessions",
    "gym_memberships",
    "gym_active_memberships",
    "gym_sets",
    "gym_visits",
  ]) {
    assert.match(migration, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`));
  }
  assert.match(
    migration,
    /REVOKE ALL ON TABLE public\.gym_sessions,[\s\S]*?FROM PUBLIC, anon, authenticated/,
  );
  assert.doesNotMatch(
    migration,
    /CREATE POLICY\s+\w+\s+ON\s+public\.gym_(sessions|memberships|active_memberships|sets)/i,
  );

  const functions = [
    "gym_create_session",
    "gym_join_session",
    "gym_get_snapshot",
    "gym_set_sharing",
    "gym_add_set",
    "gym_delete_set",
    "gym_close_session",
    "gym_get_history",
    "gym_get_visits",
    "gym_set_visit",
    "gym_set_visit_sharing",
  ];
  for (const name of functions) {
    const definition = migration.match(
      new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\([\\s\\S]*?END \\$\\$;`),
    );
    assert.ok(definition, `missing function ${name}`);
    assert.match(definition[0], /SECURITY DEFINER SET search_path = pg_catalog, public/);
    assert.match(migration, new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${name}\\(`));
    assert.match(
      migration,
      new RegExp(`REVOKE ALL ON FUNCTION public\\.${name}\\([^;]+ FROM PUBLIC, anon`),
    );
  }
  assert.match(
    migration,
    /REVOKE ALL ON FUNCTION public\.gym_snapshot_payload\(uuid,\s*date\) FROM PUBLIC, anon, authenticated/,
  );
  assert.match(migration, /auth\.uid\(\)/);
  assert.match(migration, /auth\.jwt\(\) ->> 'is_anonymous'/);
});

test("SQL enforces exactly two participants and account-serialized active membership", () => {
  assert.match(migration, /pg_advisory_xact_lock\(hashtext\(me::text\)\)/);
  assert.match(migration, /SELECT \* INTO s FROM public\.gym_sessions[\s\S]*?FOR UPDATE/);
  assert.match(migration, /member_count >= 2/);
  assert.match(migration, /s\.host_id = me[\s\S]*?host_cannot_join_own_session/);
  assert.match(migration, /user_id uuid PRIMARY KEY REFERENCES auth\.users\(id\)/);
  assert.match(
    migration,
    /upper\(substr\(replace\(gen_random_uuid\(\)::text, '-', ''\), 1, 12\)\)/,
  );
  assert.match(migration, /interval '15 minutes'/);
  assert.match(migration, /invite_expires_at <= clock_timestamp\(\)/);
});

test("snapshot reveals only own sets and opted-in partner aggregate totals", () => {
  const snapshot = migration.match(
    /CREATE OR REPLACE FUNCTION public\.gym_snapshot_payload\([\s\S]*?END \$\$;/,
  )?.[0];
  assert.ok(snapshot);
  assert.match(snapshot, /'own'[\s\S]*?'sets', own_sets/);
  assert.match(snapshot, /CASE WHEN partner\.sharing THEN partner_stats ELSE NULL END/);
  assert.match(snapshot, /'stats', CASE WHEN partner\.sharing THEN partner_stats ELSE NULL END/);
  assert.match(snapshot, /'sets', count\(\*\), 'reps', coalesce\(sum\(x\.reps\), 0\)/);
  assert.match(snapshot, /'volumeKg', coalesce\(sum\(x\.reps \* x\.weight_kg\), 0\)/);
  assert.doesNotMatch(snapshot, /'partner'[\s\S]{0,500}'userId'/);
  assert.match(snapshot, /'inviteCode', CASE WHEN s\.host_id = me AND s\.status = 'waiting'/);
  assert.match(migration, /LIMIT 500/);
  assert.match(migration, /'sessionId', h\.session_id/);
  assert.match(migration, /own_set_count >= 500[\s\S]*?session_set_limit/);
  assert.match(
    migration,
    /UPDATE public\.gym_memberships SET sharing = false, visit_share_counts = false,\s*visit_share_days = false WHERE session_id = p_session_id/,
  );
  assert.match(migration, /s\.status = 'closed'[\s\S]*?not_session_member/);
});

test("visit dates reject impossible dates and pre-2000 values", () => {
  assert.equal(validateGymDay("2024-02-29"), "2024-02-29");
  for (const day of [
    "2025-02-29",
    "2026-04-31",
    "2026-13-01",
    "1999-12-31",
    "2026-2-01",
    "not-a-day",
  ]) {
    assert.throws(() => validateGymDay(day));
  }
});

test("attendance sharing is separately opt-in and the client sends a local day", () => {
  assert.match(migration, /visit_share_counts boolean NOT NULL DEFAULT false/);
  assert.match(migration, /visit_share_days boolean NOT NULL DEFAULT false/);
  assert.match(helper, /p_visit_day: localGymDay\(\)/);
  assert.match(helper, /"gym_get_snapshot", \{ p_today: localGymDay\(\) \}/);
  assert.match(helper, /"gym_set_visit_sharing"/);
  assert.doesNotMatch(helper, /localStorage|buildAppContext|miraSend|ai-context/);
});
