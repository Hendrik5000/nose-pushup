import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFriendEntries,
  createFriendsClient,
  describeSendResult,
} from "../src/lib/friends/friends-client";
import {
  BackendNotReadyError,
  FriendFeatureError,
  RegisteredAccountRequiredError,
  type RpcGateway,
  type RpcResult,
} from "../src/lib/friends/rpc";

const ME = "11111111-1111-4111-8111-111111111111";
const FRIEND = "22222222-2222-4222-8222-222222222222";
const FRIENDSHIP = "33333333-3333-4333-8333-333333333333";

function gateway(handler: (name: string, args?: Record<string, unknown>) => RpcResult) {
  const calls: { name: string; args?: Record<string, unknown> }[] = [];
  const gw: RpcGateway = {
    rpc(name, args) {
      calls.push({ name, args });
      return Promise.resolve(handler(name, args));
    },
  };
  return { gw, calls };
}

test("getMyCode returns the normalised code", async () => {
  const { gw } = gateway(() => ({ data: "k7qm2xrt", error: null }));
  assert.equal(await createFriendsClient(gw).getMyCode(), "K7QM2XRT");
});

test("getMyCode rejects malformed server answers", async () => {
  const { gw } = gateway(() => ({ data: "oops", error: null }));
  await assert.rejects(() => createFriendsClient(gw).getMyCode(), FriendFeatureError);
});

test("missing server functions surface as BackendNotReadyError", async () => {
  const { gw } = gateway(() => ({
    data: null,
    error: { code: "PGRST202", message: "Could not find the function public.get_my_friend_code" },
  }));
  await assert.rejects(() => createFriendsClient(gw).getMyCode(), BackendNotReadyError);
});

test("guest accounts get a dedicated error", async () => {
  const { gw } = gateway(() => ({
    data: null,
    error: { code: "42501", message: "registered_account_required" },
  }));
  await assert.rejects(
    () => createFriendsClient(gw).regenerateMyCode(),
    RegisteredAccountRequiredError,
  );
});

test("sending by code validates locally and sends the normalised code", async () => {
  const { gw, calls } = gateway(() => ({
    data: { status: "sent", friendship_id: FRIENDSHIP, to_name: "Mia" },
    error: null,
  }));
  const client = createFriendsClient(gw);
  const bad = await client.sendRequestByCode("123");
  assert.equal(bad.status, "invalid_code");
  assert.equal(calls.length, 0);

  const ok = await client.sendRequestByCode("k7qm-2xrt");
  assert.equal(ok.ok, true);
  assert.equal(ok.friendshipId, FRIENDSHIP);
  assert.match(ok.message, /Mia/);
  assert.deepEqual(calls[0], { name: "send_friend_request_by_code", args: { p_code: "K7QM2XRT" } });
});

test("every server status maps to a German message and unknown statuses fail closed", async () => {
  for (const status of [
    "already_friends",
    "already_sent",
    "incoming_pending",
    "own_code",
    "invalid_code",
    "too_many_attempts",
    "too_many_pending",
    "unavailable",
  ] as const) {
    const { gw } = gateway(() => ({ data: { status }, error: null }));
    const result = await createFriendsClient(gw).sendRequestByCode("K7QM2XRT");
    assert.equal(result.status, status);
    assert.equal(result.ok, false);
    assert.equal(result.message, describeSendResult(status));
  }
  const { gw } = gateway(() => ({ data: { status: "something_new" }, error: null }));
  const unknown = await createFriendsClient(gw).sendRequestByCode("K7QM2XRT");
  assert.equal(unknown.status, "unavailable");
});

test("respond and withdraw check ids and map results", async () => {
  const { gw, calls } = gateway((name) => ({
    data: name === "respond_to_friend_request" ? "accepted" : true,
    error: null,
  }));
  const client = createFriendsClient(gw);
  await assert.rejects(() => client.respond("nope", true), FriendFeatureError);
  assert.equal(await client.respond(FRIENDSHIP, true), "accepted");
  assert.equal(await client.withdraw(FRIENDSHIP), true);
  assert.deepEqual(calls[0].args, { p_friendship_id: FRIENDSHIP, p_accept: true });
});

test("stale answers stay stale", async () => {
  const { gw } = gateway(() => ({ data: "stale", error: null }));
  assert.equal(await createFriendsClient(gw).respond(FRIENDSHIP, false), "stale");
});

test("listSent drops malformed rows", async () => {
  const { gw } = gateway(() => ({
    data: [
      {
        friendship_id: FRIENDSHIP,
        to_user_id: FRIEND,
        to_name: "Mia",
        to_avatar_url: null,
        created_at: "2026-01-01T00:00:00Z",
      },
      { friendship_id: "bad", to_user_id: FRIEND },
    ],
    error: null,
  }));
  const sent = await createFriendsClient(gw).listSent();
  assert.equal(sent.length, 1);
  assert.equal(sent[0].toName, "Mia");
});

test("buildFriendEntries keeps accepted friendships only, deduplicated and sorted", () => {
  const entries = buildFriendEntries(
    ME,
    [
      { id: "a", requester_id: ME, addressee_id: FRIEND, status: "accepted" },
      { id: "b", requester_id: FRIEND, addressee_id: ME, status: "accepted" },
      {
        id: "c",
        requester_id: ME,
        addressee_id: "44444444-4444-4444-8444-444444444444",
        status: "pending",
      },
      {
        id: "d",
        requester_id: "55555555-5555-4555-8555-555555555555",
        addressee_id: "66666666-6666-4666-8666-666666666666",
        status: "accepted",
      },
    ],
    [{ id: FRIEND, display_name: " Mia ", avatar_url: null }],
  );
  assert.equal(entries.length, 1);
  assert.equal(entries[0].displayName, "Mia");
  assert.equal(entries[0].id, FRIEND);
});
