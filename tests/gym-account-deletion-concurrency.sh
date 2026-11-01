#!/usr/bin/env bash
# Sourced only by gym-partner-local-db.sh in its disposable socket-only cluster.
# PG_BIN and TMP are supplied by that runner. No external database connection.
set -Eeuo pipefail

race_psql() { "$PG_BIN/psql" -X -v ON_ERROR_STOP=1 -qAt "$@"; }
wait_for_sleep() {
  local name="$1"
  for _ in {1..200}; do
    if [[ "$(race_psql -c "SELECT count(*) FROM pg_stat_activity WHERE application_name='$name' AND wait_event='PgSleep'")" == 1 ]]; then return 0; fi
    sleep 0.02
  done
  echo "FAIL: transaction $name did not reach its synchronization point" >&2
  return 1
}

race_psql <<'SQL'
INSERT INTO auth.users(id) VALUES
 ('20000000-0000-4000-8000-000000000001'),
 ('20000000-0000-4000-8000-000000000002');
INSERT INTO public.gym_sessions(id,host_id,status) VALUES
 ('20000000-0000-4000-8000-000000000010','20000000-0000-4000-8000-000000000001','active');
INSERT INTO public.gym_memberships(session_id,user_id,alias,sharing,visit_share_counts,visit_share_days) VALUES
 ('20000000-0000-4000-8000-000000000010','20000000-0000-4000-8000-000000000001','Race host',true,true,true),
 ('20000000-0000-4000-8000-000000000010','20000000-0000-4000-8000-000000000002','Race survivor',true,true,true);
INSERT INTO public.gym_active_memberships(user_id,session_id)
 SELECT user_id,session_id FROM public.gym_memberships WHERE session_id='20000000-0000-4000-8000-000000000010';
SQL

# A successful survivor save holds the session until commit. Host deletion waits,
# then closes the session; the committed survivor set remains in private history.
race_psql >"$TMP/save-before-delete.out" 2>&1 <<'SQL' &
SET application_name='gym_save_before_delete';
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='20000000-0000-4000-8000-000000000002';
SET LOCAL request.jwt.claims='{"is_anonymous":false}';
SELECT public.gym_add_set('20000000-0000-4000-8000-000000000010','Concurrent survivor set',8,25);
SELECT pg_sleep(1);
COMMIT;
SQL
save_pid=$!
wait_for_sleep gym_save_before_delete
race_psql -c "DELETE FROM auth.users WHERE id='20000000-0000-4000-8000-000000000001'" >"$TMP/delete-after-save.out" 2>&1 &
delete_pid=$!
wait "$save_pid" || { cat "$TMP/save-before-delete.out" >&2; exit 1; }
wait "$delete_pid" || { cat "$TMP/delete-after-save.out" >&2; exit 1; }
race_psql <<'SQL'
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM auth.users WHERE id='20000000-0000-4000-8000-000000000001')
  OR EXISTS (SELECT 1 FROM public.gym_active_memberships WHERE session_id='20000000-0000-4000-8000-000000000010')
  OR NOT EXISTS (SELECT 1 FROM public.gym_sessions WHERE id='20000000-0000-4000-8000-000000000010' AND host_id IS NULL AND status='closed') THEN
  RAISE EXCEPTION 'ASSERT: concurrent host deletion incomplete';
 END IF;
END $$;
SET ROLE authenticated;
SET request.jwt.claim.sub='20000000-0000-4000-8000-000000000002';
SET request.jwt.claims='{"is_anonymous":false}';
DO $$ DECLARE h jsonb := public.gym_get_history(); BEGIN
 IF jsonb_array_length(h) <> 1 OR h#>>'{0,exercise}' IS DISTINCT FROM 'Concurrent survivor set'
  OR public.gym_get_snapshot() IS NOT NULL THEN
  RAISE EXCEPTION 'ASSERT: committed survivor save lost during deletion: %',h;
 END IF;
END $$;
SQL

echo 'PASS: concurrent survivor save commits before host deletion without history loss'

# Reverse ordering: deletion holds the session lock until commit. A save that
# started while deletion was uncommitted must recheck status and fail, not revive it.
race_psql <<'SQL'
INSERT INTO auth.users(id) VALUES ('20000000-0000-4000-8000-000000000003');
INSERT INTO public.gym_sessions(id,host_id,status) VALUES
 ('20000000-0000-4000-8000-000000000020','20000000-0000-4000-8000-000000000003','active');
INSERT INTO public.gym_memberships(session_id,user_id,alias) VALUES
 ('20000000-0000-4000-8000-000000000020','20000000-0000-4000-8000-000000000003','Second host'),
 ('20000000-0000-4000-8000-000000000020','20000000-0000-4000-8000-000000000002','Same survivor');
INSERT INTO public.gym_active_memberships(user_id,session_id)
 SELECT user_id,session_id FROM public.gym_memberships WHERE session_id='20000000-0000-4000-8000-000000000020';
SQL
race_psql >"$TMP/delete-before-save.out" 2>&1 <<'SQL' &
SET application_name='gym_delete_before_save';
BEGIN;
DELETE FROM auth.users WHERE id='20000000-0000-4000-8000-000000000003';
SELECT pg_sleep(1);
COMMIT;
SQL
delete_pid=$!
wait_for_sleep gym_delete_before_save
if race_psql >"$TMP/save-after-delete.out" 2>&1 <<'SQL'
SET ROLE authenticated;
SET request.jwt.claim.sub='20000000-0000-4000-8000-000000000002';
SET request.jwt.claims='{"is_anonymous":false}';
SELECT public.gym_add_set('20000000-0000-4000-8000-000000000020','Must not persist',1,1);
SQL
then
  echo 'FAIL: concurrent save revived a deleted relationship' >&2
  wait "$delete_pid" || true
  exit 1
fi
wait "$delete_pid" || { cat "$TMP/delete-before-save.out" >&2; exit 1; }
grep -q 'not_active_session_member' "$TMP/save-after-delete.out" || { cat "$TMP/save-after-delete.out" >&2; exit 1; }
race_psql <<'SQL'
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.gym_sets WHERE session_id='20000000-0000-4000-8000-000000000020')
  OR EXISTS (SELECT 1 FROM public.gym_active_memberships WHERE session_id='20000000-0000-4000-8000-000000000020')
  OR EXISTS (SELECT 1 FROM public.gym_memberships WHERE session_id='20000000-0000-4000-8000-000000000020'
    AND (sharing OR visit_share_counts OR visit_share_days)) THEN
  RAISE EXCEPTION 'ASSERT: concurrent save left data or active sharing after deletion';
 END IF;
END $$;
SQL
echo 'PASS: concurrent save after host deletion is rejected without partial writes'
