import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  BATTLE_INVITATIONS_UI_ENABLED,
  canRespondToBattleInvitation,
  getBattleInvitationGateReason,
} from "../src/lib/battle-invitation-gate";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("friend battle invitations are enabled in the UI and the gate still blocks unverified or ineligible cases", () => {
  assert.equal(BATTLE_INVITATIONS_UI_ENABLED, true);
  assert.equal(
    getBattleInvitationGateReason({
      migrationVerified: false,
      isRegisteredAccount: true,
      isAcceptedFriend: true,
    }),
    "migration-unverified",
  );
  assert.equal(
    getBattleInvitationGateReason({
      migrationVerified: true,
      isRegisteredAccount: false,
      isAcceptedFriend: true,
    }),
    "registered-account-required",
  );
  assert.equal(
    getBattleInvitationGateReason({
      migrationVerified: true,
      isRegisteredAccount: true,
      isAcceptedFriend: false,
    }),
    "accepted-friend-required",
  );
  assert.equal(
    getBattleInvitationGateReason({
      migrationVerified: true,
      isRegisteredAccount: true,
      isAcceptedFriend: true,
    }),
    "ready",
  );
});

test("an invitation can only be answered by its recipient while pending, unexpired, and still friends", () => {
  const now = new Date("2026-10-26T12:00:00Z");
  const base = {
    migrationVerified: true,
    isRecipient: true,
    status: "pending" as const,
    expiresAt: "2026-10-27T12:00:00Z",
    friendshipStillAccepted: true,
    now,
  };
  assert.equal(canRespondToBattleInvitation(base), true);
  assert.equal(canRespondToBattleInvitation({ ...base, isRecipient: false }), false);
  assert.equal(canRespondToBattleInvitation({ ...base, migrationVerified: false }), false);
  assert.equal(canRespondToBattleInvitation({ ...base, status: "declined" }), false);
  assert.equal(canRespondToBattleInvitation({ ...base, expiresAt: "2026-10-26T11:59:59Z" }), false);
  assert.equal(canRespondToBattleInvitation({ ...base, friendshipStillAccepted: false }), false);
});

test("the battle lobby invites friends with one click, handles a missing backend, and preserves code battles", () => {
  const lobby = read("src/routes/_authenticated/battle.index.tsx");
  assert.match(lobby, /<BattleFriendInvitationPanel[\s\S]*?mode=\{mode\}/);
  assert.match(lobby, /onOpenBattle=\{\(battleId\) => navigate/);
  assert.match(lobby, /Battle beitreten/);
  const panel = read("src/components/BattleFriendInvitationPanel.tsx");
  assert.match(panel, /Mit Freunden kämpfen/);
  assert.match(panel, /zum Battle einladen/);
  assert.match(panel, /noch nicht eingerichtet/);
  assert.match(panel, /Battle-Codes/);
  assert.match(panel, /window\.setInterval\(\(\) => void update\(true\), 30_000\)/);
  assert.doesNotMatch(panel, /DisabledBattleFriendInvitationPanel/);
  assert.doesNotMatch(panel, /<select/);
  assert.doesNotMatch(panel, /sendPushNotification/);
  const runtime = read("src/lib/battle-invitations-runtime.ts");
  assert.match(runtime, /migrationVerified: BATTLE_INVITATIONS_UI_ENABLED/);
  const popup = read("src/components/postfach/BattleInvitationPopup.tsx");
  assert.match(popup, /Annehmen/);
  assert.match(popup, /Ablehnen/);
});

test("the database candidate exposes only recipient-scoped reads and authenticated RPC mutations", () => {
  const sql = read("supabase/migrations/20261026093000_friend_battle_invitations.sql");
  assert.match(sql, /CREATE TABLE public\.friend_battle_invitations/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(
    sql,
    /REVOKE ALL ON TABLE public\.friend_battle_invitations[\s\S]*?FROM PUBLIC, anon, authenticated, service_role/,
  );
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.create_friend_battle_invitation/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.get_my_pending_battle_invitations/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.get_my_sent_friend_battle_invitations/);
  assert.match(sql, /i\.recipient_id = me AND i\.status = 'pending'/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.respond_to_friend_battle_invitation/);
  assert.match(sql, /i\.id = p_invitation_id AND i\.recipient_id = me/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.cancel_my_friend_battle_invitation/);
  assert.match(sql, /interval '24 hours'/);
  assert.match(
    sql,
    /v_code,\s*v_invite\.sender_id,\s*me,\s*'waiting',\s*v_invite\.duration_s,\s*v_invite\.mode/,
  );
  assert.doesNotMatch(sql, /UPDATE public\.battles[\s\S]*status = 'active'/);
  assert.match(sql, /FRIEND_BATTLE_SCHEMA_MISMATCH/);
});
