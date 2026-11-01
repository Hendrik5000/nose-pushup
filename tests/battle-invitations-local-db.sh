#!/usr/bin/env bash
# Synthetic-only PostgreSQL integration test. Never connects to any remote database.
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATION="$ROOT/supabase/migrations/20261026093000_friend_battle_invitations.sql"
TEST_SQL="$ROOT/tests/battle-invitations-local.sql"
PG_BIN="/usr/lib/postgresql/16/bin"
for bin in initdb pg_ctl psql; do
  [[ -x "$PG_BIN/$bin" ]] || { echo "missing PostgreSQL binary: $PG_BIN/$bin" >&2; exit 2; }
done
[[ -f "$MIGRATION" && -f "$TEST_SQL" ]] || { echo "missing local candidate or synthetic SQL tests" >&2; exit 2; }
TMP="$(mktemp -d /tmp/friend-battle-invitations-local-db.XXXXXX)"
DATA="$TMP/data"
SOCK="$TMP/socket"
PORT=55519
mkdir -p "$SOCK"
PGHOST="$SOCK" PGPORT="$PORT" PGUSER="$(id -un)" PGDATABASE=postgres
export PGHOST PGPORT PGUSER PGDATABASE
cleanup() {
  if [[ -d "$DATA" ]]; then "$PG_BIN/pg_ctl" -D "$DATA" -m immediate stop >/dev/null 2>&1 || true; fi
  rm -rf "$TMP"
}
trap cleanup EXIT INT TERM
"$PG_BIN/initdb" -D "$DATA" --auth=trust --no-locale --encoding=UTF8 >/dev/null
"$PG_BIN/pg_ctl" -D "$DATA" -l "$TMP/postgres.log" \
  -o "-c listen_addresses='' -c unix_socket_directories='$SOCK' -p $PORT -c max_connections=30" \
  -w start >/dev/null

# Recreate only the expected battle/friend schema and synthetic roles/users.
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
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
CREATE FUNCTION auth.jwt() RETURNS jsonb
LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}')
$$;
GRANT EXECUTE ON FUNCTION auth.uid(), auth.jwt() TO anon, authenticated, service_role;
CREATE TABLE public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pending', 'accepted', 'declined', 'blocked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (requester_id <> addressee_id)
);
CREATE UNIQUE INDEX friendships_one_unordered_pair_idx
  ON public.friendships (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id));
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  avatar_url text,
  level integer NOT NULL DEFAULT 0,
  best_count integer NOT NULL DEFAULT 0
);
CREATE TABLE public.battles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  host_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  guest_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'finished', 'cancelled')),
  duration_s integer NOT NULL DEFAULT 60,
  mode text NOT NULL DEFAULT 'timed' CHECK (mode IN ('timed', 'first_to', 'sprint', 'endurance')),
  target_reps integer NOT NULL DEFAULT 0,
  is_bot boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.battles TO authenticated;
ALTER TABLE public.battles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "battles select participants" ON public.battles
  FOR SELECT TO authenticated USING (auth.uid() = host_id OR auth.uid() = guest_id);
SQL

# Policy drift must abort at the preflight before the candidate creates objects.
"$PG_BIN/psql" -X -v ON_ERROR_STOP=1 -q -c \
  "CREATE POLICY battles_select_waiting_legacy ON public.battles FOR SELECT TO authenticated USING (status = 'waiting')"
set +e
"$PG_BIN/psql" -X -v ON_ERROR_STOP=1 -q -f "$MIGRATION" >"$TMP/preflight.log" 2>&1
PREFLIGHT_STATUS=$?
set -e
if [[ "$PREFLIGHT_STATUS" -eq 0 ]] || ! grep -q 'FRIEND_BATTLE_SCHEMA_MISMATCH' "$TMP/preflight.log"; then
  cat "$TMP/preflight.log" >&2
  echo "FAIL: candidate preflight did not reject broad legacy Battle SELECT policy" >&2
  exit 1
fi
"$PG_BIN/psql" -X -v ON_ERROR_STOP=1 -q <<'SQL'
DROP POLICY battles_select_waiting_legacy ON public.battles;
DO $$
BEGIN
  IF to_regclass('public.friend_battle_invitations') IS NOT NULL THEN
    RAISE EXCEPTION 'TEST FAILED: failed preflight left invitation DDL behind';
  END IF;
END;
$$;
SQL

"$PG_BIN/psql" -X -v ON_ERROR_STOP=1 -q -f "$TEST_SQL"
"$PG_BIN/psql" -X -v ON_ERROR_STOP=1 -q <<'SQL'
DO $$
BEGIN
  IF to_regclass('public.friend_battle_invitations') IS NOT NULL
    OR to_regprocedure('public.create_friend_battle_invitation(uuid,text,integer,integer)') IS NOT NULL
    OR to_regprocedure('public.respond_to_friend_battle_invitation(uuid,boolean)') IS NOT NULL
    OR EXISTS (SELECT 1 FROM public.battles) THEN
    RAISE EXCEPTION 'TEST FAILED: candidate objects or synthetic battles survived rollback';
  END IF;
END;
$$;
SQL
echo "PASS: isolated synthetic friend-battle invitation RLS/RPC/expiry/rollback contract"
