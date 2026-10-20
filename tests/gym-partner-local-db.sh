#!/usr/bin/env bash
# Local-only integration test for the gym partner migration.
# Starts a fresh temporary PostgreSQL cluster; never connects to external DBs or Docker.
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATION="$ROOT/supabase/migrations/20261020200000_gym_partner.sql"
PG_BIN="/usr/lib/postgresql/16/bin"
for bin in initdb pg_ctl psql; do
  [[ -x "$PG_BIN/$bin" ]] || { echo "missing PostgreSQL binary: $PG_BIN/$bin" >&2; exit 2; }
done
[[ -f "$MIGRATION" ]] || { echo "missing migration: $MIGRATION" >&2; exit 2; }

TMP="$(mktemp -d /tmp/gym-partner-local-db.XXXXXX)"
DATA="$TMP/data"
SOCK="$TMP/socket"
mkdir -p "$SOCK"
PGHOST="$SOCK" PGPORT=55479 PGUSER="$(id -un)" PGDATABASE=postgres
export PGHOST PGPORT PGUSER PGDATABASE

cleanup() {
  if [[ -d "$DATA" ]]; then "$PG_BIN/pg_ctl" -D "$DATA" -m immediate stop >/dev/null 2>&1 || true; fi
  rm -rf "$TMP"
}
trap cleanup EXIT INT TERM

"$PG_BIN/initdb" -D "$DATA" --auth=trust --no-locale --encoding=UTF8 >/dev/null
"$PG_BIN/pg_ctl" -D "$DATA" -l "$TMP/postgres.log" \
  -o "-c listen_addresses='' -c unix_socket_directories='$SOCK' -p 55479 -c max_connections=40" \
  -w start >/dev/null

"$PG_BIN/psql" -X -v ON_ERROR_STOP=1 -q <<'SQL'
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
CREATE TABLE auth.users (
  id uuid PRIMARY KEY,
  is_anonymous boolean NOT NULL DEFAULT false
);
CREATE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE
AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb
LANGUAGE sql STABLE
AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) $$;
GRANT EXECUTE ON FUNCTION auth.uid(), auth.jwt() TO anon, authenticated, service_role;
SQL

# Apply exactly the requested migration; deliberately do not run the project's migration stack.
# First prove all DDL, including the auth trigger, disappears on rollback.
{
  printf 'BEGIN;\n'
  cat "$MIGRATION"
  printf '\nROLLBACK;\n'
} | "$PG_BIN/psql" -X -v ON_ERROR_STOP=1 -q >/dev/null
"$PG_BIN/psql" -X -v ON_ERROR_STOP=1 -q <<'SQL'
DO $$ BEGIN
  IF to_regclass('public.gym_sessions') IS NOT NULL
    OR to_regprocedure('public.gym_detach_deleted_account()') IS NOT NULL
    OR EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'auth.users'::regclass
      AND tgname = 'gym_detach_account_before_delete') THEN
    RAISE EXCEPTION 'ASSERT: migration DDL was not fully rolled back';
  END IF;
END $$;
SQL
"$PG_BIN/psql" -X -v ON_ERROR_STOP=1 --single-transaction -f "$MIGRATION" >/dev/null
echo "PASS: migration DDL rollback and atomic installation"

# Seed identities as the local database owner, then exercise all product calls as authenticated.
"$PG_BIN/psql" -X -v ON_ERROR_STOP=1 -q <<'SQL'
INSERT INTO auth.users(id, is_anonymous) VALUES
 ('00000000-0000-4000-8000-000000000001', false),
 ('00000000-0000-4000-8000-000000000002', false),
 ('00000000-0000-4000-8000-000000000003', false),
 ('00000000-0000-4000-8000-000000000004', false),
 ('00000000-0000-4000-8000-000000000005', false),
 ('00000000-0000-4000-8000-000000000006', false),
 ('00000000-0000-4000-8000-000000000007', false),
 ('00000000-0000-4000-8000-000000000008', false),
 ('00000000-0000-4000-8000-000000000009', false),
 ('00000000-0000-4000-8000-000000000010', false),
 ('00000000-0000-4000-8000-000000000011', true);
SQL

# Use role switching (not owner-level RPC calls) so grants and RLS/ACL behavior are exercised.
"$PG_BIN/psql" -X -v ON_ERROR_STOP=1 -q <<'SQL'
SET ROLE authenticated;
DO $test$
DECLARE
  sid uuid;
  code text;
  snap jsonb;
  own_set uuid;
  expired_sid uuid;
  expired_code text;
  closed_sid uuid;
  closed_set uuid;
  hist jsonb;
  visits jsonb;
  visit_yesterday date := current_date - 1;
  err text;
BEGIN
  -- No direct browser-role table reads or writes, including hidden rows.
  BEGIN PERFORM 1 FROM public.gym_sessions; RAISE EXCEPTION 'ASSERT: authenticated SELECT unexpectedly succeeded';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM 1 FROM public.gym_memberships; RAISE EXCEPTION 'ASSERT: authenticated SELECT memberships unexpectedly succeeded';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM 1 FROM public.gym_active_memberships; RAISE EXCEPTION 'ASSERT: authenticated SELECT active memberships unexpectedly succeeded';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM 1 FROM public.gym_sets; RAISE EXCEPTION 'ASSERT: authenticated SELECT sets unexpectedly succeeded';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN INSERT INTO public.gym_sessions(host_id) VALUES ('00000000-0000-4000-8000-000000000001');
    RAISE EXCEPTION 'ASSERT: authenticated INSERT unexpectedly succeeded';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN UPDATE public.gym_memberships SET sharing = true;
    RAISE EXCEPTION 'ASSERT: authenticated UPDATE unexpectedly succeeded';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN DELETE FROM public.gym_sets;
    RAISE EXCEPTION 'ASSERT: authenticated DELETE unexpectedly succeeded';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM 1 FROM public.gym_visits; RAISE EXCEPTION 'ASSERT: authenticated SELECT of visits unexpectedly succeeded';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN INSERT INTO public.gym_visits(user_id,day) VALUES ('00000000-0000-4000-8000-000000000001',current_date);
    RAISE EXCEPTION 'ASSERT: authenticated INSERT visit unexpectedly succeeded';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN UPDATE public.gym_visits SET day=current_date WHERE user_id='00000000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'ASSERT: authenticated UPDATE visit unexpectedly succeeded';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN DELETE FROM public.gym_visits;
    RAISE EXCEPTION 'ASSERT: authenticated DELETE visit unexpectedly succeeded';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  -- A real account creates an invite; default sharing is off and only the host sees its code.
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
  PERFORM set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","is_anonymous":false}',false);
  snap := public.gym_create_session('Host');
  sid := (snap->>'id')::uuid;
  code := snap->>'inviteCode';
  IF sid IS NULL OR code IS NULL OR snap#>>'{own,sharing}' IS DISTINCT FROM 'false'
     OR snap#>>'{own,visitSharing,counts}' IS DISTINCT FROM 'false'
     OR snap#>>'{own,visitSharing,days}' IS DISTINCT FROM 'false' THEN
    RAISE EXCEPTION 'ASSERT: create/default consent/host invite failed: %', snap;
  END IF;
  IF (public.gym_get_snapshot()#>>'{id}')::uuid <> sid THEN RAISE EXCEPTION 'ASSERT: host snapshot mismatch'; END IF;

  -- Self-join is forbidden; joining with another account activates the session.
  BEGIN PERFORM public.gym_join_session(code,'Host again'); RAISE EXCEPTION 'ASSERT: self-join unexpectedly succeeded';
    EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS err = MESSAGE_TEXT;
      IF err = 'ASSERT: self-join unexpectedly succeeded' THEN RAISE; END IF;
      IF position('host_cannot_join_own_session' in err)=0 AND position('active_session_exists' in err)=0 THEN
        RAISE EXCEPTION 'ASSERT: unexpected self-join error: %', err;
      END IF;
  END;
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
  PERFORM set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000002","is_anonymous":false}',false);
  snap := public.gym_join_session(code,'Partner');
  IF snap#>>'{own,sharing}' IS DISTINCT FROM 'false' OR snap#>>'{partner,sharing}' IS DISTINCT FROM 'false'
     OR snap#>>'{own,visitSharing,counts}' IS DISTINCT FROM 'false'
     OR snap#>>'{own,visitSharing,days}' IS DISTINCT FROM 'false'
     OR snap#>>'{partner,visitSharing,counts}' IS DISTINCT FROM 'false'
     OR snap#>>'{partner,visitSharing,days}' IS DISTINCT FROM 'false' THEN
    RAISE EXCEPTION 'ASSERT: sharing did not default off for both members: %', snap;
  END IF;
  IF snap ? 'sets' OR snap#>'{partner}' ? 'sets'
     OR snap#>'{partner,visitDays}' IS DISTINCT FROM 'null'::jsonb
     OR snap#>'{partner,visitStats}' IS DISTINCT FROM 'null'::jsonb THEN
    RAISE EXCEPTION 'ASSERT: partner full-set or visit disclosure in join snapshot: %',snap;
  END IF;

  -- Sets are always complete for their owner. Partner receives no metrics until that partner opts in.
  PERFORM public.gym_add_set(sid,'Squat',8,50);
  PERFORM public.gym_add_set(sid,'Bench press',6,40);
  PERFORM public.gym_set_visit(current_date,true);
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
  PERFORM set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","is_anonymous":false}',false);
  -- Five-argument save auto-marks this visit day; the old four-argument signature stays callable.
  PERFORM public.gym_add_set(sid,'Push-ups',10,0,current_date);
  PERFORM public.gym_add_set(sid,'Deadlift',5,60);
  PERFORM public.gym_set_visit(visit_yesterday,true);
  PERFORM public.gym_set_visit(visit_yesterday,true);
  visits := public.gym_get_visits(current_date - 30,current_date + 1);
  IF jsonb_array_length(visits) <> 2
     OR NOT (visits @> jsonb_build_array(to_char(current_date,'YYYY-MM-DD')))
     OR NOT (visits @> jsonb_build_array(to_char(visit_yesterday,'YYYY-MM-DD'))) THEN
    RAISE EXCEPTION 'ASSERT: host manual/automatic visit days were not unique/complete: %',visits;
  END IF;
  PERFORM public.gym_set_visit(visit_yesterday,false);
  visits := public.gym_get_visits(current_date - 30,current_date + 1);
  IF jsonb_array_length(visits) <> 1 OR visits @> jsonb_build_array(to_char(visit_yesterday,'YYYY-MM-DD')) THEN
    RAISE EXCEPTION 'ASSERT: clearing own visit day failed: %',visits;
  END IF;
  PERFORM public.gym_set_visit(visit_yesterday,true);
  BEGIN PERFORM public.gym_set_visit(current_date + 2,true); RAISE EXCEPTION 'ASSERT: future visit beyond allowance succeeded';
    EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS err=MESSAGE_TEXT;
      IF err='ASSERT: future visit beyond allowance succeeded' THEN RAISE; END IF;
  END;
  snap := public.gym_get_snapshot();
  IF jsonb_array_length(snap#>'{own,sets}') <> 2 OR snap#>'{partner,stats}' IS DISTINCT FROM 'null'::jsonb
     OR snap#>>'{partner,sharing}' IS DISTINCT FROM 'false' THEN
    RAISE EXCEPTION 'ASSERT: own sets / default private partner metrics failed: %',snap;
  END IF;
  IF snap#>'{partner}' ? 'sets' OR (snap#>'{partner}')::text ~* '(weightkg|health|rawSet|exercise|createdAt)' THEN
    RAISE EXCEPTION 'ASSERT: partner snapshot discloses detailed/private health data: %',snap;
  END IF;
  IF snap#>'{partner,visitStats}' IS DISTINCT FROM 'null'::jsonb
     OR snap#>'{partner,visitDays}' IS DISTINCT FROM 'null'::jsonb THEN
    RAISE EXCEPTION 'ASSERT: partner visit metrics/days leaked without independent consent: %',snap;
  END IF;
  PERFORM public.gym_set_sharing(sid,true);
  snap := public.gym_get_snapshot();
  IF snap#>'{partner,stats}' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'ASSERT: one-sided consent exposed metrics'; END IF;

  -- Visit-count consent alone exposes week/month counts, never exact visit dates.
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
  PERFORM set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000002","is_anonymous":false}',false);
  PERFORM public.gym_set_visit_sharing(sid,true,false);
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
  PERFORM set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","is_anonymous":false}',false);
  snap := public.gym_get_snapshot();
  IF snap#>>'{partner,visitSharing,counts}' IS DISTINCT FROM 'true'
     OR snap#>>'{partner,visitSharing,days}' IS DISTINCT FROM 'false'
     OR snap#>>'{partner,visitStats,weekDays}' IS DISTINCT FROM '1'
     OR snap#>>'{partner,visitStats,monthDays}' IS DISTINCT FROM '1'
     OR snap#>'{partner,visitDays}' IS DISTINCT FROM 'null'::jsonb THEN
    RAISE EXCEPTION 'ASSERT: counts-only visit consent leaked or omitted wrong data: %',snap;
  END IF;
  -- Exact-day consent alone exposes current-month dates, not counts.
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
  PERFORM set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000002","is_anonymous":false}',false);
  PERFORM public.gym_set_visit_sharing(sid,false,true);
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
  PERFORM set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","is_anonymous":false}',false);
  snap := public.gym_get_snapshot();
  IF snap#>'{partner,visitStats}' IS DISTINCT FROM 'null'::jsonb
     OR jsonb_array_length(snap#>'{partner,visitDays}') <> 1
     OR snap#>>'{partner,visitDays,0}' IS DISTINCT FROM to_char(current_date,'YYYY-MM-DD') THEN
    RAISE EXCEPTION 'ASSERT: days-only visit consent exposed counts or wrong dates: %',snap;
  END IF;
  -- Revoke both visit-sharing flags: the partner again sees neither counts nor dates.
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
  PERFORM set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000002","is_anonymous":false}',false);
  PERFORM public.gym_set_visit_sharing(sid,false,false);
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
  PERFORM set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","is_anonymous":false}',false);
  snap := public.gym_get_snapshot();
  IF snap#>'{partner,visitStats}' IS DISTINCT FROM 'null'::jsonb
     OR snap#>'{partner,visitDays}' IS DISTINCT FROM 'null'::jsonb THEN
    RAISE EXCEPTION 'ASSERT: revoked visit consent still exposes data: %',snap;
  END IF;
  -- The host's day consent is independent of visit counts and set-sharing consent.
  PERFORM public.gym_set_visit_sharing(sid,false,true);
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
  PERFORM set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000002","is_anonymous":false}',false);
  snap := public.gym_get_snapshot();
  IF snap#>>'{partner,visitSharing,counts}' IS DISTINCT FROM 'false'
     OR snap#>>'{partner,visitSharing,days}' IS DISTINCT FROM 'true'
     OR snap#>'{partner,visitStats}' IS DISTINCT FROM 'null'::jsonb
     OR NOT (snap#>'{partner,visitDays}' @> jsonb_build_array(to_char(current_date,'YYYY-MM-DD'))) THEN
    RAISE EXCEPTION 'ASSERT: other account did not independently share only own exact dates: %',snap;
  END IF;

  -- The partner's independent opt-in exposes only exact aggregates, never their set entries.
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
  PERFORM set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000002","is_anonymous":false}',false);
  PERFORM public.gym_set_sharing(sid,true);
  snap := public.gym_get_snapshot();
  IF snap#>>'{partner,stats,sets}' IS DISTINCT FROM '2' OR snap#>>'{partner,stats,reps}' IS DISTINCT FROM '15'
     OR (snap#>>'{partner,stats,volumeKg}')::numeric IS DISTINCT FROM 300 THEN
    RAISE EXCEPTION 'ASSERT: aggregates do not match host own sets: %',snap;
  END IF;
  IF snap#>'{partner}' ? 'sets' OR snap#>'{partner}' ? 'health' THEN RAISE EXCEPTION 'ASSERT: partner detailed-data disclosure: %',snap; END IF;
  IF jsonb_array_length(snap#>'{own,sets}') <> 2 THEN RAISE EXCEPTION 'ASSERT: partner cannot see complete own set list: %',snap; END IF;
  PERFORM public.gym_set_sharing(sid,false);
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
  PERFORM set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","is_anonymous":false}',false);
  snap := public.gym_get_snapshot();
  IF snap#>'{partner,stats}' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'ASSERT: revoked consent still exposes aggregates'; END IF;

  -- An unrelated account gets no snapshot/history/data and cannot mutate the active session.
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',false);
  PERFORM set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000003","is_anonymous":false}',false);
  IF public.gym_get_snapshot() IS NOT NULL OR public.gym_get_history() <> '[]'::jsonb THEN
    RAISE EXCEPTION 'ASSERT: outsider received session/history data';
  END IF;
  visits := public.gym_get_visits(current_date - 30,current_date + 1);
  IF jsonb_array_length(visits) <> 0 THEN RAISE EXCEPTION 'ASSERT: outsider received visit days: %',visits; END IF;
  BEGIN PERFORM public.gym_add_set(sid,'Intrusion',1,1); RAISE EXCEPTION 'ASSERT: outsider wrote a set';
    EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS err=MESSAGE_TEXT;
      IF err='ASSERT: outsider wrote a set' THEN RAISE; END IF;
      IF position('not_active_session_member' in err)=0 THEN RAISE EXCEPTION 'ASSERT: unexpected outsider add error: %',err; END IF;
  END;
  -- Invitation has been consumed; a third account cannot join the two-person session.
  BEGIN PERFORM public.gym_join_session(code,'Third'); RAISE EXCEPTION 'ASSERT: third member joined';
    EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS err=MESSAGE_TEXT;
      IF err='ASSERT: third member joined' THEN RAISE; END IF;
      IF position('invite_unavailable' in err)=0 AND position('session_full' in err)=0 THEN
        RAISE EXCEPTION 'ASSERT: unexpected third-member denial: %',err;
      END IF;
  END;

  -- Anonymous identities are blocked even if SQL executes as the authenticated role.
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000011',false);
  PERFORM set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000011","is_anonymous":true}',false);
  BEGIN PERFORM public.gym_create_session('Anon'); RAISE EXCEPTION 'ASSERT: anonymous create succeeded';
    EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS err=MESSAGE_TEXT;
      IF err='ASSERT: anonymous create succeeded' THEN RAISE; END IF;
      IF position('real_account_required' in err)=0 THEN RAISE EXCEPTION 'ASSERT: anonymous account error: %',err; END IF;
  END;
END $test$;
RESET ROLE;

-- Anonymous database role cannot execute authenticated RPCs or access protected tables.
SET ROLE anon;
DO $anon$
DECLARE err text;
BEGIN
  BEGIN PERFORM public.gym_create_session('Anon'); RAISE EXCEPTION 'ASSERT: anon role executed RPC';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM 1 FROM public.gym_sessions; RAISE EXCEPTION 'ASSERT: anon role read table';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM 1 FROM public.gym_visits; RAISE EXCEPTION 'ASSERT: anon role read visits';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $anon$;
RESET ROLE;
SQL

# A separate authenticated identity tests invite expiry, cleanup, and subsequent create.
# Seed an expired row as the temporary cluster owner; product behavior is then tested as authenticated.
"$PG_BIN/psql" -X -v ON_ERROR_STOP=1 -q <<'SQL'
INSERT INTO public.gym_sessions(id,host_id,status,invite_code,invite_expires_at)
VALUES ('10000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000004',
        'waiting','EEEEEEEEEEEE',clock_timestamp()-interval '1 second');
INSERT INTO public.gym_memberships(session_id,user_id,alias)
VALUES ('10000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000004','Expiry host');
INSERT INTO public.gym_active_memberships(user_id,session_id)
VALUES ('00000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000004');
SQL
"$PG_BIN/psql" -X -v ON_ERROR_STOP=1 -q <<'SQL'
SET ROLE authenticated;
DO $expiry$
DECLARE snap jsonb; err text;
BEGIN
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000004',false);
  PERFORM set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000004","is_anonymous":false}',false);
  IF public.gym_get_snapshot() IS NOT NULL THEN RAISE EXCEPTION 'ASSERT: expired invite remained an active snapshot'; END IF;
  BEGIN PERFORM public.gym_join_session('EEEEEEEEEEEE','Expired joiner'); RAISE EXCEPTION 'ASSERT: expired invite accepted';
    EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS err=MESSAGE_TEXT;
      IF err='ASSERT: expired invite accepted' THEN RAISE; END IF;
      IF position('invite_unavailable' in err)=0 THEN RAISE EXCEPTION 'ASSERT: wrong expiry denial: %',err; END IF;
  END;
  snap := public.gym_create_session('After expiry');
  IF snap->>'id' IS NULL THEN RAISE EXCEPTION 'ASSERT: expired account could not create a new session'; END IF;
END $expiry$;
RESET ROLE;
SQL

# A closed session stays in each member's own private history, with no partner detail.
TEST_FAILURE=0
if ! "$PG_BIN/psql" -X -v ON_ERROR_STOP=1 -q >"$TMP/closing.out" 2>&1 <<'SQL'
SET ROLE authenticated;
DO $closing$
DECLARE sid uuid; code text; snap jsonb; hist jsonb; err text; setid uuid;
BEGIN
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000005',false);
  PERFORM set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000005","is_anonymous":false}',false);
  snap := public.gym_create_session('Close host'); sid := (snap->>'id')::uuid; code := snap->>'inviteCode';
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000006',false);
  PERFORM set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000006","is_anonymous":false}',false);
  PERFORM public.gym_join_session(code,'Close partner');
  PERFORM public.gym_add_set(sid,'Partner private set',7,42);
  PERFORM public.gym_set_sharing(sid,true);
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000005',false);
  PERFORM set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000005","is_anonymous":false}',false);
  snap := public.gym_add_set(sid,'Host private set',3,25); setid := (snap->>'id')::uuid;
  PERFORM public.gym_close_session(sid);
  IF public.gym_get_snapshot() IS NOT NULL THEN RAISE EXCEPTION 'ASSERT: closed session snapshot still active'; END IF;
  hist := public.gym_get_history();
  IF jsonb_array_length(hist) <> 1 OR hist#>>'{0,exercise}' IS DISTINCT FROM 'Host private set'
     OR hist#>'{0,partner}' IS NOT NULL THEN
    RAISE EXCEPTION 'ASSERT: closed host history is not private/own-only: %',hist;
  END IF;
  BEGIN PERFORM public.gym_add_set(sid,'Closed mutation',1,1); RAISE EXCEPTION 'ASSERT: add on closed session succeeded';
    EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS err=MESSAGE_TEXT;
      IF err='ASSERT: add on closed session succeeded' THEN RAISE; END IF;
      IF position('not_active_session_member' in err)=0 THEN RAISE EXCEPTION 'ASSERT: add closed error: %',err; END IF;
  END;
  BEGIN PERFORM public.gym_set_sharing(sid,false); RAISE EXCEPTION 'ASSERT: consent mutation on closed session succeeded';
    EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS err=MESSAGE_TEXT;
      IF err='ASSERT: consent mutation on closed session succeeded' THEN RAISE; END IF;
      IF position('not_open_session_member' in err)=0 THEN RAISE EXCEPTION 'ASSERT: sharing closed error: %',err; END IF;
  END;
  -- Deleting after close is also prohibited; report a backend bug but continue remaining checks.
  BEGIN
    PERFORM public.gym_delete_set(sid,setid);
    RAISE NOTICE 'KNOWN_FAILURE: gym_delete_set allowed mutation after session close';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS err=MESSAGE_TEXT;
    IF position('not_session_member' in err)=0 AND position('not_open_session_member' in err)=0
       AND position('closed' in err)=0 AND position('not_active' in err)=0 THEN RAISE; END IF;
  END;
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000006',false);
  PERFORM set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000006","is_anonymous":false}',false);
  hist := public.gym_get_history();
  IF jsonb_array_length(hist) <> 1 OR hist#>>'{0,exercise}' IS DISTINCT FROM 'Partner private set'
     OR hist#>'{0,partner}' IS NOT NULL THEN
    RAISE EXCEPTION 'ASSERT: closed partner history leaks other member data: %',hist;
  END IF;
END $closing$;
RESET ROLE;
SQL
then
  cat "$TMP/closing.out" >&2
  exit 1
fi
cat "$TMP/closing.out"
if grep -q 'KNOWN_FAILURE:' "$TMP/closing.out"; then TEST_FAILURE=1; fi

# Exercise advisory-lock serialization and the one-winner invitation row lock with simultaneous clients.
psql_call() {
  "$PG_BIN/psql" -X -v ON_ERROR_STOP=1 -qAt "$@"
}
launch_status() {
  local outfile="$1" errfile="$2"; shift 2
  psql_call -c "$*" >"$outfile" 2>"$errfile"
}
USER7=00000000-0000-4000-8000-000000000007
USER8=00000000-0000-4000-8000-000000000008
USER9=00000000-0000-4000-8000-000000000009
USER10=00000000-0000-4000-8000-000000000010

create_sql="SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','$USER7',false); SELECT set_config('request.jwt.claims','{\"sub\":\"$USER7\",\"is_anonymous\":false}',false); SELECT public.gym_create_session('Race creator');"
launch_status "$TMP/create1.out" "$TMP/create1.err" "$create_sql" & p1=$!
launch_status "$TMP/create2.out" "$TMP/create2.err" "$create_sql" & p2=$!
set +e; wait "$p1"; c1=$?; wait "$p2"; c2=$?; set -e
if (( (c1 == 0) + (c2 == 0) != 1 )); then
  echo "FAIL: concurrent create for one account must have exactly one winner (statuses $c1,$c2)" >&2
  cat "$TMP/create1.err" "$TMP/create2.err" >&2; exit 1
fi
# Close winner via the same authorized API before reusing the identity.
psql_call -c "SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','$USER7',false); SELECT set_config('request.jwt.claims','{\"sub\":\"$USER7\",\"is_anonymous\":false}',false); SELECT public.gym_close_session((public.gym_get_snapshot()->>'id')::uuid);" >/dev/null

echo "PASS: concurrent create has exactly one winner"

# Create one invite as user 8, then race two unrelated invitees against it.
invite_sql="SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','$USER8',false); SELECT set_config('request.jwt.claims','{\"sub\":\"$USER8\",\"is_anonymous\":false}',false); SELECT public.gym_create_session('Race host')->>'inviteCode';"
INVITE="$(psql_call -c "$invite_sql" | tail -n 1)"
[[ -n "$INVITE" ]] || { echo 'FAIL: race invite creation returned no invite code' >&2; exit 1; }
join_sql1="SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','$USER9',false); SELECT set_config('request.jwt.claims','{\"sub\":\"$USER9\",\"is_anonymous\":false}',false); SELECT public.gym_join_session('$INVITE','Race one');"
join_sql2="SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','$USER10',false); SELECT set_config('request.jwt.claims','{\"sub\":\"$USER10\",\"is_anonymous\":false}',false); SELECT public.gym_join_session('$INVITE','Race two');"
launch_status "$TMP/join1.out" "$TMP/join1.err" "$join_sql1" & p1=$!
launch_status "$TMP/join2.out" "$TMP/join2.err" "$join_sql2" & p2=$!
set +e; wait "$p1"; j1=$?; wait "$p2"; j2=$?; set -e
if (( (j1 == 0) + (j2 == 0) != 1 )); then
  echo "FAIL: concurrent joins must have exactly one winner (statuses $j1,$j2)" >&2
  cat "$TMP/join1.err" "$TMP/join2.err" >&2; exit 1
fi
echo "PASS: concurrent joins have exactly one winner"
if (( TEST_FAILURE )); then
  echo "FAIL: gym-partner migration has the known closed-session delete bug (see above)" >&2
  exit 1
fi

# Dedicated account-deletion cases run in the same disposable local-only cluster.
"$PG_BIN/psql" -X -v ON_ERROR_STOP=1 -q -f "$ROOT/tests/gym-account-deletion.sql"
source "$ROOT/tests/gym-account-deletion-concurrency.sh"
echo "PASS: local gym-partner migration integration checks completed"
