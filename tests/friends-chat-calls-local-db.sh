#!/usr/bin/env bash
# Local-only integration test for the friend code / Postfach / Nexus / calls migrations.
# Starts a fresh temporary PostgreSQL cluster with Supabase-like stubs, applies the repository
# migrations in order and runs tests/friends-chat-calls-local.sql. It never connects to external
# databases or Docker. Override the PostgreSQL location with PG_BIN=/path/to/bin if needed.
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PG_BIN="${PG_BIN:-/usr/lib/postgresql/16/bin}"
for bin in initdb pg_ctl psql; do
  [[ -x "$PG_BIN/$bin" ]] || { echo "missing PostgreSQL binary: $PG_BIN/$bin" >&2; exit 2; }
done

TMP="$(mktemp -d /tmp/friends-chat-calls-local-db.XXXXXX)"
DATA="$TMP/data"
SOCK="$TMP/socket"
mkdir -p "$SOCK"
PGHOST="$SOCK" PGPORT=55481 PGUSER="$(id -un)" PGDATABASE=postgres
export PGHOST PGPORT PGUSER PGDATABASE

cleanup() {
  if [[ -d "$DATA" ]]; then "$PG_BIN/pg_ctl" -D "$DATA" -m immediate stop >/dev/null 2>&1 || true; fi
  rm -rf "$TMP"
}
trap cleanup EXIT INT TERM

"$PG_BIN/initdb" -D "$DATA" --auth=trust --no-locale --encoding=UTF8 >/dev/null
"$PG_BIN/pg_ctl" -D "$DATA" -l "$TMP/postgres.log" \
  -o "-c listen_addresses='' -c unix_socket_directories='$SOCK' -p 55481 -c max_connections=40" \
  -w start >/dev/null

"$PG_BIN/psql" -X -v ON_ERROR_STOP=1 -q <<'SQL'
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
CREATE TABLE auth.users (
  id uuid PRIMARY KEY,
  email text,
  is_anonymous boolean NOT NULL DEFAULT false,
  raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE
AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE
AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'authenticated') $$;
GRANT EXECUTE ON FUNCTION auth.uid(), auth.jwt(), auth.role() TO anon, authenticated, service_role;
GRANT SELECT ON auth.users TO service_role;
CREATE SCHEMA storage;
GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
CREATE TABLE storage.buckets (
  id text PRIMARY KEY, name text, public boolean DEFAULT false,
  file_size_limit bigint, allowed_mime_types text[]
);
CREATE TABLE storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text, name text, owner uuid, metadata jsonb
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated;
CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE
AS $$ SELECT (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
GRANT EXECUTE ON FUNCTION storage.foldername(text) TO anon, authenticated;
CREATE PUBLICATION supabase_realtime;
SQL

# 20260808165102_* re-creates public.push_subscriptions that 20260805140000_push_subscriptions.sql
# already created (the live database received them in a different order). It is unrelated to this
# test, so it is skipped explicitly instead of hiding other migration errors.
for migration in "$ROOT"/supabase/migrations/*.sql; do
  case "$(basename "$migration")" in
    20260808165102_*) continue ;;
  esac
  "$PG_BIN/psql" -X -v ON_ERROR_STOP=1 --single-transaction -q -f "$migration" >/dev/null
done
echo "PASS: migration chain applied"

"$PG_BIN/psql" -X -v ON_ERROR_STOP=1 -q -f "$ROOT/tests/friends-chat-calls-local.sql"
echo "PASS: friend code, Postfach, Nexus, image and call assertions"
