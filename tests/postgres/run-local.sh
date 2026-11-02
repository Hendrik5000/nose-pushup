#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PG_BIN="${PG_BIN:-$(pg_config --bindir)}"
TMP_DIR="$(mktemp -d /tmp/nose-pushup-pgtest.XXXXXX)"
DATA_DIR="$TMP_DIR/data"
SOCKET_DIR="$TMP_DIR/socket"
PORT="$(python3 - <<'PY'
import socket
with socket.socket() as sock:
    sock.bind(("127.0.0.1", 0))
    print(sock.getsockname()[1])
PY
)"

mkdir -p "$DATA_DIR" "$SOCKET_DIR"
sudo chown -R postgres:postgres "$TMP_DIR"
sudo chmod 755 "$TMP_DIR"
sudo chmod 700 "$SOCKET_DIR"

cleanup() {
  sudo -u postgres "$PG_BIN/pg_ctl" -D "$DATA_DIR" stop -m fast >/dev/null 2>&1 || true
  sudo rm -rf -- "$TMP_DIR"
}
trap cleanup EXIT

sudo -u postgres "$PG_BIN/initdb" -D "$DATA_DIR" \
  --auth-local=trust --auth-host=reject --no-locale --encoding=UTF8 >/dev/null
sudo -u postgres "$PG_BIN/pg_ctl" -D "$DATA_DIR" \
  -o "-c listen_addresses='' -k $SOCKET_DIR -p $PORT" \
  -l "$TMP_DIR/postgres.log" -w start >/dev/null

export PGHOST="$SOCKET_DIR"
export PGPORT="$PORT"
export PGUSER=postgres
export PGDATABASE=postgres
export PSQL="$(command -v psql)"

sudo -u postgres env PGHOST="$PGHOST" PGPORT="$PGPORT" PGUSER=postgres PGDATABASE=postgres \
  psql -X -v ON_ERROR_STOP=1 < "$ROOT/tests/postgres/setup.sql"
sudo -u postgres env PGHOST="$PGHOST" PGPORT="$PGPORT" PGUSER=postgres PGDATABASE=postgres \
  psql -X -v ON_ERROR_STOP=1 < "$ROOT/supabase/migrations/20261102140000_invitation_join_security.sql"
python3 "$ROOT/tests/postgres/run_cases.py"
