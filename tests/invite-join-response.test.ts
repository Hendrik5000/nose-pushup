import assert from "node:assert/strict";
import test from "node:test";
import {
  inviteRpcUnavailable,
  parseBattleInviteResponse,
  parseClubInviteResponse,
  parsePublicMatchResponse,
} from "../src/lib/invite-join-response";

const BATTLE = "11111111-1111-4111-8111-111111111111";
const HOST = "22222222-2222-4222-8222-222222222222";
const CODE = "0123456789ABCDEF0123456789ABCDEF";

test("club success requires a strict UUID and explicit boolean success", () => {
  assert.deepEqual(parseClubInviteResponse({ success: true, club_id: BATTLE }), { id: BATTLE });
  for (const value of [
    null,
    [],
    {},
    BATTLE,
    { success: "true", club_id: BATTLE },
    { success: true, club_id: null },
    { success: true, club_id: "/clubs/foreign" },
    { success: true, battle_id: BATTLE },
  ]) {
    assert.throws(() => parseClubInviteResponse(value));
  }
});

test("battle success requires identity metadata and a confirmed new-join flag", () => {
  for (const joined of [true, false]) {
    assert.deepEqual(
      parseBattleInviteResponse({ success: true, battle_id: BATTLE, host_id: HOST, joined }),
      { id: BATTLE, hostId: HOST, joined },
    );
  }
  for (const patch of [
    { joined: undefined },
    { joined: "true" },
    { host_id: null },
    { battle_id: "foreign" },
  ]) {
    assert.throws(() =>
      parseBattleInviteResponse({
        success: true,
        battle_id: BATTLE,
        host_id: HOST,
        joined: true,
        ...patch,
      }),
    );
  }
});

test("public matchmaking accepts only new safe codes and explicit matched state", () => {
  assert.deepEqual(
    parsePublicMatchResponse({ success: true, battle_id: BATTLE, code: CODE, matched: false }),
    { id: BATTLE, code: CODE, matched: false },
  );
  for (const patch of [
    { code: "ABC123" },
    { code: CODE.toLowerCase() },
    { matched: undefined },
    { matched: 1 },
  ]) {
    assert.throws(() =>
      parsePublicMatchResponse({
        success: true,
        battle_id: BATTLE,
        code: CODE,
        matched: true,
        ...patch,
      }),
    );
  }
});

test("expected failures and unavailable RPCs never expose provider or SQL details", () => {
  for (const parse of [
    parseClubInviteResponse,
    parseBattleInviteResponse,
    parsePublicMatchResponse,
  ]) {
    assert.throws(() => parse({ success: false, error: "RATE_LIMITED" }), /Minute|Minute/i);
    assert.throws(
      () => parse({ success: false, error: "SQL secret token postgresql://internal" }),
      (error: unknown) =>
        error instanceof Error && !/SQL|secret|postgresql|token/.test(error.message),
    );
  }
  assert.doesNotMatch(inviteRpcUnavailable().message, /PGRST|SQL|schema|token/);
});

test("queue cancellation requires exactly one confirmed outcome, including a raced match", async () => {
  const { parsePublicQueueLeaveResponse } = await import("../src/lib/invite-join-response");
  for (const matched of [false, true]) {
    assert.deepEqual(
      parsePublicQueueLeaveResponse({
        success: true,
        battle_id: BATTLE,
        matched,
        cancelled: !matched,
      }),
      { id: BATTLE, matched, cancelled: !matched },
    );
  }
  for (const patch of [
    { matched: false, cancelled: false },
    { matched: true, cancelled: true },
    { matched: "false", cancelled: true },
    { cancelled: undefined },
    { battle_id: "foreign" },
  ]) {
    assert.throws(() =>
      parsePublicQueueLeaveResponse({
        success: true,
        battle_id: BATTLE,
        matched: false,
        cancelled: true,
        ...patch,
      }),
    );
  }
  assert.throws(() => parsePublicQueueLeaveResponse({ success: false, error: "NOT_FOUND" }));
});
