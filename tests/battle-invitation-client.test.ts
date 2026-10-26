import assert from "node:assert/strict";
import test from "node:test";
import {
  createBattleInvitationClient,
  type BattleInvitationGateway,
  type BattleInvitationRpcArguments,
  type BattleInvitationRpcName,
  type BattleInvitationGatewayResult,
} from "../src/lib/battle-invitation-client";

const OWNER = "11000000-0000-4000-8000-000000000001";
const FRIEND = "22000000-0000-4000-8000-000000000002";
const OTHER_FRIEND = "44000000-0000-4000-8000-000000000004";
const STRANGER = "33000000-0000-4000-8000-000000000003";
const INVITATION = "55000000-0000-4000-8000-000000000005";
const BATTLE = "66000000-0000-4000-8000-000000000006";
const LATER = "2026-10-27T12:00:00.000Z";
const CREATED = "2026-10-26T12:00:00.000Z";

type RpcCall = {
  name: BattleInvitationRpcName;
  args: BattleInvitationRpcArguments[BattleInvitationRpcName];
};

class MockGateway implements BattleInvitationGateway {
  user: { id: string; isAnonymous: boolean } | null = { id: OWNER, isAnonymous: false };
  friendships = [
    { requester_id: OWNER, addressee_id: FRIEND, status: "accepted" },
    { requester_id: OWNER, addressee_id: STRANGER, status: "pending" },
  ];
  profiles = [
    { id: FRIEND, display_name: "Freund A", avatar_url: "friend-a.png" },
    { id: OTHER_FRIEND, display_name: "Freund B", avatar_url: null },
    { id: STRANGER, display_name: "Nicht bestätigt", avatar_url: null },
  ];
  incoming: unknown[] = [];
  sent: unknown[] = [];
  battle = {
    id: BATTLE,
    code: "ABC123",
    status: "waiting",
    host_id: OWNER,
    guest_id: FRIEND as string | null,
    is_bot: false,
  };
  calls: RpcCall[] = [];
  gatewayCalls = 0;
  rpcOverrides = new Map<BattleInvitationRpcName, unknown>();

  async getCurrentUser(): Promise<
    BattleInvitationGatewayResult<{ id: string; isAnonymous: boolean }>
  > {
    this.gatewayCalls += 1;
    return { data: this.user, error: null };
  }

  async listFriendships(userId: string) {
    this.gatewayCalls += 1;
    return {
      data: this.friendships.filter(
        (friendship) => friendship.requester_id === userId || friendship.addressee_id === userId,
      ),
      error: null,
    };
  }

  async getFriendProfiles(userIds: string[]) {
    this.gatewayCalls += 1;
    return { data: this.profiles.filter((profile) => userIds.includes(profile.id)), error: null };
  }

  async rpc<K extends BattleInvitationRpcName>(
    name: K,
    args: BattleInvitationRpcArguments[K],
  ): Promise<BattleInvitationGatewayResult<unknown>> {
    this.gatewayCalls += 1;
    this.calls.push({ name, args } as RpcCall);
    if (this.rpcOverrides.has(name)) {
      return { data: this.rpcOverrides.get(name) ?? null, error: null };
    }
    if (name === "get_friend_public_profiles") {
      return {
        data: this.profiles.filter((profile) => args.p_user_ids.includes(profile.id)),
        error: null,
      };
    }
    if (name === "get_my_pending_battle_invitations") return { data: this.incoming, error: null };
    if (name === "get_my_sent_friend_battle_invitations") return { data: this.sent, error: null };
    if (name === "create_friend_battle_invitation") return { data: INVITATION, error: null };
    if (name === "respond_to_friend_battle_invitation") {
      return {
        data: [
          {
            result: args.p_accept ? "accepted" : "declined",
            battle_id: args.p_accept ? BATTLE : null,
          },
        ],
        error: null,
      };
    }
    if (name === "cancel_my_friend_battle_invitation") return { data: true, error: null };
    return { data: null, error: null };
  }

  async getBattleById(battleId: string) {
    this.gatewayCalls += 1;
    return { data: this.battle.id === battleId ? this.battle : null, error: null };
  }
}

function incomingInvitation(overrides: Record<string, unknown> = {}) {
  return {
    invitation_id: INVITATION,
    sender_id: FRIEND,
    sender_display_name: "Freund A",
    sender_avatar_url: "friend-a.png",
    mode: "first_to",
    duration_s: 180,
    target_reps: 30,
    created_at: CREATED,
    expires_at: LATER,
    ...overrides,
  };
}

function sentInvitation(overrides: Record<string, unknown> = {}) {
  return {
    invitation_id: INVITATION,
    recipient_id: FRIEND,
    status: "pending",
    battle_id: null,
    mode: "timed",
    created_at: CREATED,
    expires_at: LATER,
    responded_at: null,
    ...overrides,
  };
}

function createEnabledClient(gateway: MockGateway) {
  return createBattleInvitationClient(gateway, { migrationVerified: true });
}

test("the default production adapter is closed before any gateway or database-like call", async () => {
  const gateway = new MockGateway();
  const client = createBattleInvitationClient(gateway);
  assert.equal(client.enabled, false);
  await assert.rejects(client.loadDashboard(), /gesperrt/);
  await assert.rejects(
    client.sendInvitation({ recipientId: FRIEND, mode: "timed", durationS: 60, targetReps: 0 }),
    /gesperrt/,
  );
  assert.equal(gateway.gatewayCalls, 0);
});

test("dashboard loads only accepted friends and recipient-scoped incoming plus sender-scoped status", async () => {
  const gateway = new MockGateway();
  gateway.incoming = [incomingInvitation()];
  gateway.sent = [sentInvitation()];
  const dashboard = await createEnabledClient(gateway).loadDashboard();
  assert.equal(dashboard.userId, OWNER);
  assert.deepEqual(dashboard.friends, [
    { id: FRIEND, displayName: "Freund A", avatarUrl: "friend-a.png" },
  ]);
  assert.equal(dashboard.incoming[0]?.senderId, FRIEND);
  assert.equal(dashboard.sent[0]?.status, "pending");
  assert.ok(gateway.calls.some((call) => call.name === "get_my_pending_battle_invitations"));
  assert.ok(gateway.calls.some((call) => call.name === "get_my_sent_friend_battle_invitations"));
});

test("duplicate accepted friendship rows fail closed rather than exposing an ambiguous picker", async () => {
  const gateway = new MockGateway();
  gateway.friendships.push({ requester_id: FRIEND, addressee_id: OWNER, status: "accepted" });
  await assert.rejects(createEnabledClient(gateway).loadDashboard(), /Mehrdeutige Freundschaft/);
});

test("creating an invitation rechecks accepted friendship and validates battle settings", async () => {
  const gateway = new MockGateway();
  const client = createEnabledClient(gateway);
  await assert.rejects(
    client.sendInvitation({ recipientId: STRANGER, mode: "timed", durationS: 60, targetReps: 0 }),
    /Nur aktuell bestätigte Freunde/,
  );
  assert.equal(
    gateway.calls.some((call) => call.name === "create_friend_battle_invitation"),
    false,
  );
  await assert.rejects(
    client.sendInvitation({ recipientId: FRIEND, mode: "timed", durationS: 601, targetReps: 0 }),
    /Einstellungen sind ungültig/,
  );
  const invitationId = await client.sendInvitation({
    recipientId: FRIEND,
    mode: "first_to",
    durationS: 180,
    targetReps: 30,
  });
  assert.equal(invitationId, INVITATION);
  assert.deepEqual(
    gateway.calls.find((call) => call.name === "create_friend_battle_invitation")?.args,
    { p_recipient_id: FRIEND, p_mode: "first_to", p_duration_s: 180, p_target_reps: 30 },
  );
});

test("recipient responses fail closed for stale, revoked, and expired invitations", async () => {
  const gateway = new MockGateway();
  const client = createEnabledClient(gateway);
  gateway.incoming = [];
  assert.deepEqual(await client.respondToInvitation(INVITATION, FRIEND, true), {
    result: "stale",
    battleId: null,
  });
  assert.equal(
    gateway.calls.some((call) => call.name === "respond_to_friend_battle_invitation"),
    false,
  );

  gateway.incoming = [incomingInvitation()];
  gateway.friendships = [];
  assert.deepEqual(await client.respondToInvitation(INVITATION, FRIEND, true), {
    result: "stale",
    battleId: null,
  });
  assert.equal(
    gateway.calls.some((call) => call.name === "respond_to_friend_battle_invitation"),
    false,
  );

  gateway.friendships = [{ requester_id: OWNER, addressee_id: FRIEND, status: "accepted" }];
  gateway.incoming = [
    incomingInvitation({
      created_at: "2026-10-24T12:00:00.000Z",
      expires_at: "2026-10-25T11:59:59.000Z",
    }),
  ];
  assert.deepEqual(await client.respondToInvitation(INVITATION, FRIEND, true), {
    result: "stale",
    battleId: null,
  });
  assert.equal(
    gateway.calls.some((call) => call.name === "respond_to_friend_battle_invitation"),
    false,
  );
});

test("the recipient may accept into a waiting battle or decline without starting it", async () => {
  const gateway = new MockGateway();
  gateway.incoming = [incomingInvitation()];
  const client = createEnabledClient(gateway);
  assert.deepEqual(await client.respondToInvitation(INVITATION, FRIEND, true), {
    result: "accepted",
    battleId: BATTLE,
  });
  assert.deepEqual(await client.respondToInvitation(INVITATION, FRIEND, false), {
    result: "declined",
    battleId: null,
  });
  assert.equal(
    gateway.calls.filter((call) => call.name === "respond_to_friend_battle_invitation").length,
    2,
  );
});

test("sender can cancel only a still-pending invitation and receives status through its own outbox", async () => {
  const gateway = new MockGateway();
  gateway.sent = [sentInvitation()];
  const client = createEnabledClient(gateway);
  assert.equal(await client.cancelInvitation(INVITATION), true);
  assert.equal(gateway.calls.at(-1)?.name, "cancel_my_friend_battle_invitation");

  gateway.calls = [];
  gateway.sent = [sentInvitation({ status: "accepted", battle_id: BATTLE })];
  assert.equal(await client.cancelInvitation(INVITATION), false);
  assert.equal(
    gateway.calls.some((call) => call.name === "cancel_my_friend_battle_invitation"),
    false,
  );

  gateway.sent = [
    sentInvitation({
      created_at: "2026-10-24T12:00:00.000Z",
      expires_at: "2026-10-25T11:59:59.000Z",
    }),
  ];
  assert.equal(await client.cancelInvitation(INVITATION), false);
  assert.equal(
    gateway.calls.some((call) => call.name === "cancel_my_friend_battle_invitation"),
    false,
  );
});

test("waiting-match lookup requires the current friend pair and a participant-owned waiting battle", async () => {
  const gateway = new MockGateway();
  const client = createEnabledClient(gateway);
  assert.deepEqual(await client.lookupWaitingBattle(BATTLE, FRIEND), { id: BATTLE });
  gateway.battle.status = "active";
  assert.equal(await client.lookupWaitingBattle(BATTLE, FRIEND), null);
  gateway.battle.status = "waiting";
  gateway.battle.guest_id = OTHER_FRIEND;
  assert.equal(await client.lookupWaitingBattle(BATTLE, FRIEND), null);
  gateway.friendships = [];
  assert.equal(await client.lookupWaitingBattle(BATTLE, FRIEND), null);
});

test("account changes during dashboard loading discard the result", async () => {
  const gateway = new MockGateway();
  gateway.getCurrentUser = async () => {
    gateway.gatewayCalls += 1;
    const id = gateway.gatewayCalls === 1 ? OWNER : FRIEND;
    return { data: { id, isAnonymous: false }, error: null };
  };
  await assert.rejects(
    createEnabledClient(gateway).loadDashboard(),
    /aktive Konto hat sich geändert/,
  );
});

test("anonymous accounts cannot use the synthetic enabled adapter", async () => {
  const gateway = new MockGateway();
  gateway.user = { id: OWNER, isAnonymous: true };
  await assert.rejects(createEnabledClient(gateway).loadDashboard(), /registrierten Konto/);
});
