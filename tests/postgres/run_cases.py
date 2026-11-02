#!/usr/bin/env python3
"""Integration tests run only against the disposable local cluster from run-local.sh."""

from concurrent.futures import ThreadPoolExecutor
import os
import subprocess
import sys

PSQL = os.environ.get("PSQL", "psql")

USERS = {
    "host": "00000000-0000-0000-0000-000000000001",
    "guest": "00000000-0000-0000-0000-000000000002",
    "invalid": "00000000-0000-0000-0000-000000000003",
    "battle_limit": "00000000-0000-0000-0000-000000000004",
    "club_limit": "00000000-0000-0000-0000-000000000005",
    "parallel_battle": "00000000-0000-0000-0000-000000000006",
    "parallel_club": "00000000-0000-0000-0000-000000000007",
    "nonparticipant": "00000000-0000-0000-0000-000000000008",
    "battle_joiner": "00000000-0000-0000-0000-000000000009",
    "club_joiner": "00000000-0000-0000-0000-000000000010",
}

BATTLE_START = "10000000-0000-0000-0000-000000000001"
BATTLE_NOT_READY = "10000000-0000-0000-0000-000000000002"
BATTLE_FINISH = "10000000-0000-0000-0000-000000000003"
BATTLE_BOT_FINISH = "10000000-0000-0000-0000-000000000004"
BATTLE_BOT_START = "10000000-0000-0000-0000-000000000005"
CLUB_JOIN = "20000000-0000-0000-0000-000000000001"


def psql(
    sql: str,
    *,
    user_id: str | None = None,
    expect_success: bool | None = True,
):
    if user_id is not None:
        sql = (
            "SET ROLE authenticated; "
            f"SET request.jwt.claim.sub = '{user_id}'; "
            + sql
        )
    result = subprocess.run(
        [
            "sudo",
            "-u",
            "postgres",
            "env",
            f"PGHOST={os.environ['PGHOST']}",
            f"PGPORT={os.environ['PGPORT']}",
            "PGUSER=postgres",
            "PGDATABASE=postgres",
            PSQL,
            "-X",
            "-qAt",
            "-v",
            "ON_ERROR_STOP=1",
            "-c",
            sql,
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if expect_success is True and result.returncode != 0:
        raise AssertionError(f"psql failed: {result.stderr}\nSQL: {sql}")
    if expect_success is False and result.returncode == 0:
        raise AssertionError(f"psql unexpectedly succeeded: {sql}\n{result.stdout}")
    return result


def scalar(sql: str) -> str:
    return psql(sql).stdout.strip()


def attempt_count(user_id: str, kind: str) -> int:
    value = scalar(
        "SELECT attempt_count FROM public.invitation_join_limits "
        f"WHERE user_id = '{user_id}' AND invitation_kind = '{kind}'"
    )
    return int(value)


def battle_join(user_id: str, code: str, *, expect_success: bool | None = True):
    return psql(
        "SELECT success::text || '|' || COALESCE(joined_id::text, 'null') || '|' "
        f"|| COALESCE(error_code, 'null') FROM public.join_battle_by_code('{code}')",
        user_id=user_id,
        expect_success=expect_success,
    )


def club_join(user_id: str, code: str, *, expect_success: bool | None = True):
    return psql(
        "SELECT success::text || '|' || COALESCE(club_id::text, 'null') || '|' "
        f"|| COALESCE(error_code, 'null') FROM public.join_club_by_code('{code}')",
        user_id=user_id,
        expect_success=expect_success,
    )


def assert_attempt_threshold(user_id: str, kind: str, join_call):
    psql("DELETE FROM public.invitation_join_limits WHERE user_id = "
         f"'{user_id}' AND invitation_kind = '{kind}'")
    for index in range(1, 9):
        result = join_call(user_id, "NOPE1234")
        assert result.stdout.strip() == "false|null|not_found", result.stdout
        expected = index
        actual = attempt_count(user_id, kind)
        assert actual == expected, f"attempt {index}: stored {actual}, expected {expected}"
    blocked_sql = (
        "SELECT * FROM public.join_battle_by_code('NOPE1234')"
        if kind == "battle"
        else "SELECT * FROM public.join_club_by_code('NOPE1234')"
    )
    blocked = psql(
        blocked_sql,
        user_id=user_id,
        expect_success=False,
    )
    assert "Too many invitation attempts" in blocked.stderr, blocked.stderr
    assert attempt_count(user_id, kind) == 8


def parallel_attempts(user_id: str, kind: str, join_call):
    psql("DELETE FROM public.invitation_join_limits WHERE user_id = "
         f"'{user_id}' AND invitation_kind = '{kind}'")
    with ThreadPoolExecutor(max_workers=12) as pool:
        futures = [
            pool.submit(join_call, user_id, "PARA1234", expect_success=None)
            for _ in range(12)
        ]
        results = [future.result() for future in futures]
    allowed = [r for r in results if r.returncode == 0]
    blocked = [r for r in results if r.returncode != 0]
    assert len(allowed) == 8, f"parallel {kind}: expected 8 allowed, got {len(allowed)}"
    assert len(blocked) == 4, f"parallel {kind}: expected 4 blocked, got {len(blocked)}"
    assert all("false|null|not_found" in r.stdout for r in allowed)
    assert all("Too many invitation attempts" in r.stderr for r in blocked)
    assert attempt_count(user_id, kind) == 8


def main():
    psql(
        "INSERT INTO public.battles "
        "(id, code, host_id, guest_id, status, is_bot) VALUES "
        f"('{BATTLE_START}', 'START111', '{USERS['host']}', '{USERS['guest']}', 'waiting', false), "
        f"('{BATTLE_NOT_READY}', 'WAIT1111', '{USERS['host']}', NULL, 'waiting', false), "
        f"('{BATTLE_FINISH}', 'FINISH11', '{USERS['host']}', '{USERS['guest']}', 'active', false), "
        f"('{BATTLE_BOT_FINISH}', 'BOTFIN11', '{USERS['host']}', NULL, 'active', true), "
        f"('{BATTLE_BOT_START}', 'BOTSTA11', '{USERS['host']}', NULL, 'waiting', true), "
        "('10000000-0000-0000-0000-000000000006', 'JOINBAT1', "
        f"'{USERS['host']}', NULL, 'waiting', false); "
        "INSERT INTO public.clubs (id, code, owner_id) VALUES "
        f"('{CLUB_JOIN}', 'JOINCLUB1', '{USERS['host']}')"
    )

    malformed = battle_join(USERS["invalid"], "!")
    assert malformed.stdout.strip() == "false|null|invalid_code", malformed.stdout
    assert attempt_count(USERS["invalid"], "battle") == 1

    assert_attempt_threshold(USERS["battle_limit"], "battle", battle_join)
    assert_attempt_threshold(USERS["club_limit"], "club", club_join)

    parallel_attempts(USERS["parallel_battle"], "battle", battle_join)
    parallel_attempts(USERS["parallel_club"], "club", club_join)

    joined = battle_join(USERS["battle_joiner"], "JOINBAT1")
    assert joined.stdout.strip() == f"true|10000000-0000-0000-0000-000000000006|null"
    assert scalar(
        "SELECT guest_id::text FROM public.battles "
        "WHERE id = '10000000-0000-0000-0000-000000000006'"
    ) == USERS["battle_joiner"]

    club_result = club_join(USERS["club_joiner"], "JOINCLUB1")
    assert club_result.stdout.strip() == f"true|{CLUB_JOIN}|null"
    assert scalar(
        f"SELECT count(*) FROM public.club_members WHERE club_id = '{CLUB_JOIN}' "
        f"AND user_id = '{USERS['club_joiner']}'"
    ) == "1"

    denied_start = psql(
        f"SELECT public.start_battle('{BATTLE_START}')",
        user_id=USERS["guest"],
        expect_success=False,
    )
    assert "Nur der Host kann starten" in denied_start.stderr
    psql(f"SELECT public.start_battle('{BATTLE_START}')", user_id=USERS["host"])
    assert scalar(f"SELECT status FROM public.battles WHERE id = '{BATTLE_START}'") == "active"
    assert scalar(f"SELECT started_at IS NOT NULL FROM public.battles WHERE id = '{BATTLE_START}'") == "t"

    not_ready = psql(
        f"SELECT public.start_battle('{BATTLE_NOT_READY}')",
        user_id=USERS["host"],
        expect_success=False,
    )
    assert "Noch kein Gegner" in not_ready.stderr
    psql(f"SELECT public.start_battle('{BATTLE_BOT_START}')", user_id=USERS["host"])
    assert scalar(f"SELECT status FROM public.battles WHERE id = '{BATTLE_BOT_START}'") == "active"

    psql(
        "INSERT INTO public.battle_reps (battle_id, user_id, count) VALUES "
        f"('{BATTLE_FINISH}', '{USERS['host']}', 1), "
        f"('{BATTLE_FINISH}', '{USERS['host']}', 1), "
        f"('{BATTLE_FINISH}', '{USERS['host']}', 1), "
        f"('{BATTLE_FINISH}', '{USERS['guest']}', 1), "
        f"('{BATTLE_FINISH}', '{USERS['guest']}', 1), "
        f"('{BATTLE_BOT_FINISH}', '{USERS['host']}', 1), "
        f"('{BATTLE_BOT_FINISH}', '{USERS['host']}', 1), "
        f"('{BATTLE_BOT_FINISH}', '{USERS['host']}', 1), "
        f"('{BATTLE_BOT_FINISH}', '{USERS['host']}', 1)"
    )
    finish = psql(
        "SELECT COALESCE(winner_id::text, 'null') || '|' || host_count || '|' || guest_count "
        f"FROM public.finish_battle('{BATTLE_FINISH}', 9999)",
        user_id=USERS["host"],
    )
    assert finish.stdout.strip() == f"{USERS['host']}|3|2", finish.stdout
    repeated_finish = psql(
        "SELECT COALESCE(winner_id::text, 'null') || '|' || host_count || '|' || guest_count "
        f"FROM public.finish_battle('{BATTLE_FINISH}', 0)",
        user_id=USERS["guest"],
    )
    assert repeated_finish.stdout.strip() == f"{USERS['host']}|3|2", repeated_finish.stdout
    assert scalar(f"SELECT status FROM public.battles WHERE id = '{BATTLE_FINISH}'") == "finished"

    bot_finish = psql(
        "SELECT COALESCE(winner_id::text, 'null') || '|' || host_count || '|' || guest_count "
        f"FROM public.finish_battle('{BATTLE_BOT_FINISH}', 6)",
        user_id=USERS["host"],
    )
    assert bot_finish.stdout.strip() == "null|4|6", bot_finish.stdout

    print("PASS: failed battle/club codes commit counters; first attempt is 1; limit is exactly 8")
    print("PASS: 12 parallel calls per RPC yield exactly 8 allowed and 4 rate-limited")
    print("PASS: battle join/club join, host-only start, readiness gate, ledger-based finish and idempotency")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        raise
