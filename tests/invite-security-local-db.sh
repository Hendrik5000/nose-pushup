#!/usr/bin/env bash
# Synthetic-only PostgreSQL integration test. Never uses an external database.
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PG_BIN="/usr/lib/postgresql/16/bin"
TEST_SQL="$ROOT/tests/invite-security-local.sql"

usage() {
  echo "usage: $0 /absolute/or/relative/path/to/reviewed-candidate.sql" >&2
  echo "The candidate must be a regular local SQL file; database URLs are refused." >&2
}
if [[ $# -ne 1 ]]; then usage; exit 2; fi
CANDIDATE_INPUT="$1"
if [[ "$CANDIDATE_INPUT" =~ ^[[:alpha:]][[:alnum:].+-]*:// ]] || [[ "$CANDIDATE_INPUT" == *"@"* && "$CANDIDATE_INPUT" == *":"* ]]; then
  echo "REFUSED: candidate argument looks like a database URL, not a local SQL path" >&2; exit 2
fi
[[ -f "$CANDIDATE_INPUT" && -r "$CANDIDATE_INPUT" ]] || { echo "missing readable candidate SQL file: $CANDIDATE_INPUT" >&2; exit 2; }
CANDIDATE="$(realpath -- "$CANDIDATE_INPUT")"
[[ -f "$TEST_SQL" ]] || { echo "missing fixture SQL: $TEST_SQL" >&2; exit 2; }
[[ "$(id -u)" -ne 0 ]] || { echo "refusing to run initdb as root" >&2; exit 2; }
for bin in initdb pg_ctl psql; do
  [[ -x "$PG_BIN/$bin" ]] || { echo "missing PostgreSQL 16 binary: $PG_BIN/$bin" >&2; exit 2; }
done

# Candidate is reviewed SQL, not a psql driver. Reject connection escapes, shell
# escapes, external COPY/FDW/dblink and obvious remote connection strings.
if grep -Ein '^[[:space:]]*\\(connect|!|copy|include|i)([[:space:]]|$)|postgres(ql)?://|COPY[[:space:]].*PROGRAM|CREATE[[:space:]]+(SERVER|USER[[:space:]]+MAPPING)|dblink|postgres_fdw' "$CANDIDATE"; then
  echo "REFUSED: candidate contains a psql/network escape pattern; inspect locally and remove it before running" >&2
  exit 2
fi
TMP="$(mktemp -d /tmp/invite-security-local-db.XXXXXX)"
chmod 700 "$TMP"
DATA="$TMP/data"
SOCK="$TMP/socket"
PORT="$(python3 - <<'PY'
import secrets
print(54000 + secrets.randbelow(10000))
PY
)"
DB_USER="$(id -un)"
mkdir -m 700 "$SOCK"
cleanup() {
  if [[ -d "$DATA" ]]; then "$PG_BIN/pg_ctl" -D "$DATA" -m immediate stop >/dev/null 2>&1 || true; fi
  rm -rf -- "$TMP"
}
trap cleanup EXIT INT TERM

# Clear libpq service/URL settings and explicitly connect only through this
# private Unix-domain socket. The temporary server has no TCP listener.
unset PGHOST PGPORT PGUSER PGDATABASE PGPASSWORD PGSERVICE PGSERVICEFILE PGOPTIONS PGSSLMODE PGSSLROOTCERT PGSSLKEY PGSSLCERT || true
local_psql() {
  env -u PGHOST -u PGPORT -u PGUSER -u PGDATABASE -u PGPASSWORD -u PGSERVICE -u PGSERVICEFILE \
    "$PG_BIN/psql" -X --no-password -h "$SOCK" -p "$PORT" -U "$DB_USER" -d postgres \
    -v ON_ERROR_STOP=1 "$@"
}

"$PG_BIN/initdb" -D "$DATA" --auth=trust --no-locale --encoding=UTF8 >/dev/null
"$PG_BIN/pg_ctl" -D "$DATA" -l "$TMP/postgres.log" \
  -o "-c listen_addresses='' -c unix_socket_directories='$SOCK' -p $PORT -c max_connections=40 -c log_connections=off" \
  -w start >/dev/null

# Fixture setup, historical friend RPC migration, candidate SQL and serial contract.
local_psql -q -v candidate_path="$CANDIDATE" -f "$TEST_SQL"

# Assert JSON response shape without trusting psql formatting.
json_field() {
  python3 -c 'import json,sys; v=json.loads(sys.stdin.read()).get(sys.argv[1], ""); print(str(v).lower() if isinstance(v,bool) else v)' "$1" <<<"$2"
}
assert_json_success() {
  local response="$1" expected="$2" joined="${3:-}"
  [[ "$(json_field success "$response")" == "$expected" ]] || { echo "FAIL: expected success=$expected, got $response" >&2; return 1; }
  if [[ -n "$joined" ]]; then [[ "$(json_field joined "$response")" == "$joined" ]] || { echo "FAIL: expected joined=$joined, got $response" >&2; return 1; }; fi
}
assert_json_bool() {
  local response="$1" field="$2" expected="$3"
  [[ "$(json_field "$field" "$response")" == "$expected" ]] || { echo "FAIL: expected $field=$expected, got $response" >&2; return 1; }
}
query_scalar() { local_psql -XAtq -c "$1" | tail -n 1; }

# Keep callers paused on the requested relation lock until both independent
# authenticated psql connections are waiting; then release the lock and race.
wait_for_lock_waiters() {
  local names_sql="$1" expected="$2" i count
  for i in $(seq 1 200); do
    count="$(query_scalar "SELECT count(*) FROM pg_stat_activity WHERE application_name IN ($names_sql) AND wait_event_type='Lock'")"
    [[ "$count" == "$expected" ]] && return 0
    sleep 0.05
  done
  echo "FAIL: caller connections did not both reach the local lock barrier" >&2
  return 1
}
start_blocker() {
  local relation="$1" row_id="${2:-}" lock_sql
  lock_sql="LOCK TABLE public.$relation IN EXCLUSIVE MODE"
  if [[ -n "$row_id" ]]; then
    lock_sql="SELECT id FROM public.$relation WHERE id=:'barrier_row_id'::uuid FOR UPDATE"
  fi
  PGAPPNAME=invite_security_barrier local_psql -X -q -v barrier_row_id="$row_id" \
    <<< "BEGIN; $lock_sql; SELECT pg_sleep(30); COMMIT" \
    >"$TMP/barrier.log" 2>&1 &
  BLOCKER_PID=$!
  for _ in $(seq 1 100); do
    if query_scalar "SELECT count(*) FROM pg_stat_activity WHERE application_name='invite_security_barrier' AND wait_event='PgSleep'" | grep -qx '1'; then return 0; fi
    sleep 0.05
  done
  echo "FAIL: local lock barrier did not start" >&2; return 1
}
release_blocker() {
  local_psql -XAtq -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE application_name='invite_security_barrier' AND pid<>pg_backend_pid()" >/dev/null
  wait "$BLOCKER_PID" >/dev/null 2>&1 || true
}
call_join_battle() {
  local uid="$1" code="$2" app="$3"
  PGAPPNAME="$app" local_psql -XAtq -v uid="$uid" -v invite_code="$code" \
    <<< "SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', :'uid', false); SELECT public.join_battle_by_code(:'invite_code');" \
    | tail -n 1
}
call_join_club() {
  local uid="$1" code="$2" app="$3"
  PGAPPNAME="$app" local_psql -XAtq -v uid="$uid" -v invite_code="$code" \
    <<< "SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', :'uid', false); SELECT public.join_club_by_invite_code(:'invite_code');" \
    | tail -n 1
}

# Two users race for one private waiting battle: exactly one new guest claim.
RACE_BATTLE='b0000000-0000-4000-8000-000000000002'
RACE_BATTLE_CODE="$(query_scalar "SELECT code FROM public.battles WHERE id='$RACE_BATTLE'")"
start_blocker battles
(PGAPPNAME=invite_security_battle_a call_join_battle '60000000-0000-4000-8000-000000000006' "$RACE_BATTLE_CODE" invite_security_battle_a >"$TMP/battle-a.json") & PA=$!
(PGAPPNAME=invite_security_battle_b call_join_battle '70000000-0000-4000-8000-000000000007' "$RACE_BATTLE_CODE" invite_security_battle_b >"$TMP/battle-b.json") & PB=$!
wait_for_lock_waiters "'invite_security_battle_a','invite_security_battle_b'" 2
release_blocker
wait "$PA"; wait "$PB"
BA="$(tail -n 1 "$TMP/battle-a.json")"; BB="$(tail -n 1 "$TMP/battle-b.json")"
SA="$(json_field success "$BA")"; SB="$(json_field success "$BB")"
# Use parsed strings rather than shell arithmetic over JSON booleans.
if [[ "$SA" == true && "$SB" == false ]]; then assert_json_bool "$BA" joined true
elif [[ "$SA" == false && "$SB" == true ]]; then assert_json_bool "$BB" joined true
else echo "FAIL: concurrent battle join did not produce exactly one winner: $BA / $BB" >&2; exit 1; fi
GUEST_COUNT="$(query_scalar "SELECT count(*) FROM public.battles WHERE id='$RACE_BATTLE' AND guest_id IN ('60000000-0000-4000-8000-000000000006','70000000-0000-4000-8000-000000000007')")"
[[ "$GUEST_COUNT" == 1 ]] || { echo "FAIL: concurrent battle claims left $GUEST_COUNT guests" >&2; exit 1; }

# Two users race to fill the 30th place in a club already containing 29 members.
CAP_CLUB='c0000000-0000-4000-8000-000000000002'
CAP_CODE="$(query_scalar "SELECT code FROM public.clubs WHERE id='$CAP_CLUB'")"
start_blocker club_members
(PGAPPNAME=invite_security_club_a call_join_club '60000000-0000-4000-8000-000000000006' "$CAP_CODE" invite_security_club_a >"$TMP/club-a.json") & PA=$!
(PGAPPNAME=invite_security_club_b call_join_club '70000000-0000-4000-8000-000000000007' "$CAP_CODE" invite_security_club_b >"$TMP/club-b.json") & PB=$!
wait_for_lock_waiters "'invite_security_club_a','invite_security_club_b'" 2
release_blocker
wait "$PA"; wait "$PB"
CA="$(tail -n 1 "$TMP/club-a.json")"; CB="$(tail -n 1 "$TMP/club-b.json")"
CSA="$(json_field success "$CA")"; CSB="$(json_field success "$CB")"
if [[ "$CSA" == true && "$CSB" == false ]]; then :
elif [[ "$CSA" == false && "$CSB" == true ]]; then :
else echo "FAIL: concurrent club joins did not produce exactly one 30th member: $CA / $CB" >&2; exit 1; fi
MEMBERS="$(query_scalar "SELECT count(*) FROM public.club_members WHERE club_id='$CAP_CLUB'")"
JOINERS="$(query_scalar "SELECT count(*) FROM public.club_members WHERE club_id='$CAP_CLUB' AND user_id IN ('60000000-0000-4000-8000-000000000006','70000000-0000-4000-8000-000000000007')")"
[[ "$MEMBERS" == 30 && "$JOINERS" == 1 ]] || { echo "FAIL: cap club has $MEMBERS members and $JOINERS race joiners" >&2; exit 1; }

# Nine independently committed calls for one identity contend at the same time.
# Exactly eight may consume an attempt; the ninth must see RATE_LIMITED.
start_blocker join_attempt_ratelimit
RATE_PIDS=()
for index in $(seq 1 9); do
  (call_join_battle 'a1000000-0000-4000-8000-000000000037' '00000000000000000000000000000000' "invite_security_rate_$index" >"$TMP/rate-$index.json") &
  RATE_PIDS+=("$!")
done
wait_for_lock_waiters "'invite_security_rate_1','invite_security_rate_2','invite_security_rate_3','invite_security_rate_4','invite_security_rate_5','invite_security_rate_6','invite_security_rate_7','invite_security_rate_8','invite_security_rate_9'" 9
release_blocker
for pid in "${RATE_PIDS[@]}"; do wait "$pid"; done
python3 - "$TMP" <<'PY'
import json, pathlib, sys
responses = [json.loads((pathlib.Path(sys.argv[1]) / f"rate-{i}.json").read_text()) for i in range(1, 10)]
assert all(r.get("success") is False for r in responses), responses
assert sum(r.get("error") == "RATE_LIMITED" for r in responses) == 1, responses
assert sum(r.get("error") == "BATTLE_NOT_FOUND" for r in responses) == 8, responses
PY
[[ "$(query_scalar "SELECT cardinality(attempts) FROM public.join_attempt_ratelimit WHERE user_id='a1000000-0000-4000-8000-000000000037' AND scope='battle'")" == 8 ]] || { echo 'FAIL: concurrent limit did not persist exactly eight attempts' >&2; exit 1; }

# Public matching cannot reuse the private waiting battle. Own polling is stable;
# another user cannot cancel it, and the owner can cancel only its own public wait.
PUB_USER='80000000-0000-4000-8000-000000000008'
OTHER_USER='90000000-0000-4000-8000-000000000009'
public_call() {
  local uid="$1" sql="$2" app="${3:-invite_security_public}"
  PGAPPNAME="$app" local_psql -XAtq -v uid="$uid" -v battle_id="$4" \
    <<< "SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', :'uid', false); $sql;" | tail -n 1
}
PUB1="$(public_call "$PUB_USER" "SELECT public.find_public_battle_match('timed',60,0);" invite_security_public_1 '')"
# If the API returns an error, fail instead of silently accepting private fallback.
assert_json_success "$PUB1" true
PUB2="$(public_call "$PUB_USER" "SELECT public.find_public_battle_match('timed',60,0);" invite_security_public_2 '')"
assert_json_success "$PUB2" true
PUB_ID="$(json_field battle_id "$PUB1")"
[[ -n "$PUB_ID" && "$PUB_ID" == "$(json_field battle_id "$PUB2")" ]] || { echo "FAIL: own public queue polling did not reuse the same battle: $PUB1 / $PUB2" >&2; exit 1; }
IS_PRIVATE="$(query_scalar "SELECT is_private::text FROM public.battles WHERE id='$PUB_ID'")"
[[ "$IS_PRIVATE" == false ]] || { echo "FAIL: public matcher returned private battle $PUB1" >&2; exit 1; }

# Switching an owner's unmatched queue configuration retires the old waiting
# public row instead of leaving duplicate stale queue entries.
OLD_CONFIG_ID="$PUB_ID"
PUB_CONFIG_CHANGED="$(public_call "$PUB_USER" "SELECT public.find_public_battle_match('sprint',60,0);" invite_security_config_change '')"
assert_json_success "$PUB_CONFIG_CHANGED" true
PUB_ID="$(json_field battle_id "$PUB_CONFIG_CHANGED")"
[[ -n "$PUB_ID" && "$PUB_ID" != "$OLD_CONFIG_ID" ]] || { echo "FAIL: changed public queue configuration reused the stale battle" >&2; exit 1; }
OLD_CONFIG_STATUS="$(query_scalar "SELECT status FROM public.battles WHERE id='$OLD_CONFIG_ID'")"
[[ "$OLD_CONFIG_STATUS" == cancelled ]] || { echo "FAIL: stale public queue remained $OLD_CONFIG_STATUS" >&2; exit 1; }

PRIVATE_LEAVE="$(public_call "$OTHER_USER" "SELECT public.leave_public_battle_queue(:'battle_id'::uuid);" invite_security_private_leave "$RACE_BATTLE")"
assert_json_success "$PRIVATE_LEAVE" false
[[ "$(json_field error "$PRIVATE_LEAVE")" == NOT_FOUND ]] || { echo "FAIL: private battle cancellation disclosed a different result: $PRIVATE_LEAVE" >&2; exit 1; }

# Another user cannot cancel the owner's public waiting battle.
OTHER_LEAVE="$(public_call "$OTHER_USER" "SELECT public.leave_public_battle_queue(:'battle_id'::uuid);" invite_security_other_leave "$PUB_ID")"
assert_json_success "$OTHER_LEAVE" false
[[ "$(json_field error "$OTHER_LEAVE")" == NOT_FOUND ]] || { echo "FAIL: foreign cancellation did not return generic NOT_FOUND: $OTHER_LEAVE" >&2; exit 1; }
OWNER_LEAVE="$(public_call "$PUB_USER" "SELECT public.leave_public_battle_queue(:'battle_id'::uuid);" invite_security_owner_leave "$PUB_ID")"
assert_json_success "$OWNER_LEAVE" true
assert_json_bool "$OWNER_LEAVE" matched false
assert_json_bool "$OWNER_LEAVE" cancelled true

# Requeue user A, then force matching user B to reach the waiting battle before
# the owner's cancellation call. Block the actual row, not an earlier table scan;
# cancellation must report matched=true and leave the claim intact.
REQUEUE="$(public_call "$PUB_USER" "SELECT public.find_public_battle_match('timed',60,0);" invite_security_requeue '')"
assert_json_success "$REQUEUE" true
MATCH_RACE_ID="$(json_field battle_id "$REQUEUE")"
start_blocker battles "$MATCH_RACE_ID"
(PGAPPNAME=invite_security_match_first local_psql -XAtq -v uid="$OTHER_USER" \
  <<< "SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', :'uid', false); SELECT public.find_public_battle_match('timed',60,0);" \
  >"$TMP/match-first.json") & PA=$!
wait_for_lock_waiters "'invite_security_match_first'" 1
(PGAPPNAME=invite_security_cancel_second local_psql -XAtq -v uid="$PUB_USER" -v battle_id="$MATCH_RACE_ID" \
  <<< "SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', :'uid', false); SELECT public.leave_public_battle_queue(:'battle_id'::uuid);" \
  >"$TMP/cancel-second.json") & PB=$!
wait_for_lock_waiters "'invite_security_match_first','invite_security_cancel_second'" 2
release_blocker
wait "$PA"; wait "$PB"
MATCHED="$(tail -n 1 "$TMP/match-first.json")"; CANCEL="$(tail -n 1 "$TMP/cancel-second.json")"
assert_json_success "$MATCHED" true
assert_json_bool "$MATCHED" matched true
GUEST_POLL="$(public_call "$OTHER_USER" "SELECT public.find_public_battle_match('timed',60,0);" invite_security_guest_poll '')"
assert_json_success "$GUEST_POLL" true
assert_json_bool "$GUEST_POLL" matched true
[[ "$(json_field battle_id "$GUEST_POLL")" == "$MATCH_RACE_ID" ]] || { echo "FAIL: already-joined guest poll did not reuse the matched battle: $GUEST_POLL" >&2; exit 1; }
assert_json_success "$CANCEL" true
assert_json_bool "$CANCEL" matched true
assert_json_bool "$CANCEL" cancelled false

# Reverse the actual row-lock order: cancellation wins, so the other caller
# must queue elsewhere and may never resurrect or claim the cancelled row.
CANCEL_USER='a1000000-0000-4000-8000-000000000034'
LATE_USER='a1000000-0000-4000-8000-000000000035'
CANCEL_QUEUE="$(public_call "$CANCEL_USER" "SELECT public.find_public_battle_match('timed',60,0);" invite_security_reverse_setup '')"
assert_json_success "$CANCEL_QUEUE" true
CANCEL_ID="$(json_field battle_id "$CANCEL_QUEUE")"
start_blocker battles "$CANCEL_ID"
(public_call "$CANCEL_USER" "SELECT public.leave_public_battle_queue(:'battle_id'::uuid);" invite_security_cancel_first "$CANCEL_ID" >"$TMP/cancel-first.json") & PA=$!
wait_for_lock_waiters "'invite_security_cancel_first'" 1
(public_call "$LATE_USER" "SELECT public.find_public_battle_match('timed',60,0);" invite_security_match_second '' >"$TMP/match-second.json") & PB=$!
wait_for_lock_waiters "'invite_security_cancel_first','invite_security_match_second'" 2
release_blocker
wait "$PA"; wait "$PB"
CANCEL_FIRST="$(tail -n 1 "$TMP/cancel-first.json")"; MATCH_SECOND="$(tail -n 1 "$TMP/match-second.json")"
assert_json_success "$CANCEL_FIRST" true
assert_json_bool "$CANCEL_FIRST" cancelled true
assert_json_bool "$CANCEL_FIRST" matched false
assert_json_success "$MATCH_SECOND" true
[[ "$(json_field battle_id "$MATCH_SECOND")" != "$CANCEL_ID" ]] || { echo 'FAIL: matcher resurrected the cancelled battle' >&2; exit 1; }
[[ "$(query_scalar "SELECT count(*) FROM public.battles WHERE id='$CANCEL_ID' AND status='cancelled' AND guest_id IS NULL")" == 1 ]] || { echo 'FAIL: cancel-first row was claimed or lost' >&2; exit 1; }

# Preserve historical membership, private visibility and old active/finished rows;
# cluster teardown is the only cleanup, never a shared database rollback/drop.
local_psql -X -v ON_ERROR_STOP=1 -q <<'SQL'
DO $$
BEGIN
  IF (SELECT count(*) FROM public.club_members WHERE club_id='c0000000-0000-4000-8000-000000000002') <> 30 THEN
    RAISE EXCEPTION 'TEST FAILED: capacity-club membership result not preserved';
  END IF;
  IF (SELECT code FROM public.battles WHERE id='b0000000-0000-4000-8000-000000000003') <> 'ACTIVEHISTORY'
     OR (SELECT code FROM public.battles WHERE id='b0000000-0000-4000-8000-000000000004') <> 'FINISHEDHIST' THEN
    RAISE EXCEPTION 'TEST FAILED: battle history codes changed';
  END IF;
  IF (SELECT guest_id FROM public.battles WHERE id='b0000000-0000-4000-8000-000000000001') <> '20000000-0000-4000-8000-000000000002'::uuid THEN
    RAISE EXCEPTION 'TEST FAILED: authorized invited guest was lost';
  END IF;
  IF (SELECT status FROM public.battles WHERE id='b0000000-0000-4000-8000-000000000001') <> 'waiting' THEN
    RAISE EXCEPTION 'TEST FAILED: private battle status changed';
  END IF;
END;
$$;
SQL

echo "PASS: isolated socket-only PostgreSQL invite security contract, two-connection battle/club races, public match/cancel checks"
