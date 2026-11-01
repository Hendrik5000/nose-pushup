import assert from "node:assert/strict";
import test from "node:test";
import {
  countActionable,
  countUnread,
  createPostfachClient,
  describeBattleSettings,
  describePostfachItem,
  findNewItems,
  isActionable,
  parsePostfachItem,
  parsePostfachItems,
  type PostfachGateway,
} from "../src/lib/friends/postfach";
import { BackendNotReadyError } from "../src/lib/friends/rpc";

const U1 = "11111111-1111-4111-8111-111111111111";
const I1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const I2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const I3 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const NOW = Date.parse("2026-10-30T12:00:00Z");

const row = (over: Record<string, unknown>) => ({
  id: I1,
  user_id: U1,
  kind: "friend_request",
  from_user_id: U1,
  ref_id: I2,
  payload: { from_name: "Mia" },
  created_at: "2026-10-30T10:00:00Z",
  read_at: null,
  resolved_at: null,
  resolution: null,
  ...over,
});

test("parsing rejects unknown kinds and malformed ids", () => {
  assert.equal(parsePostfachItem(row({ kind: "spam" })), null);
  assert.equal(parsePostfachItem(row({ id: "x" })), null);
  assert.equal(parsePostfachItem(null), null);
  assert.equal(parsePostfachItem(row({}))?.fromName, "Mia");
});

test("items are sorted newest first", () => {
  const items = parsePostfachItems([
    row({ id: I1, created_at: "2026-10-30T08:00:00Z" }),
    row({ id: I2, created_at: "2026-10-30T09:00:00Z" }),
  ]);
  assert.deepEqual(
    items.map((i) => i.id),
    [I2, I1],
  );
});

test("expired battle invitations are neither actionable nor unread", () => {
  const live = parsePostfachItem(
    row({
      kind: "battle_invitation",
      payload: { from_name: "Mia", expires_at: "2026-10-31T00:00:00Z" },
    }),
  )!;
  const dead = parsePostfachItem(
    row({
      id: I2,
      kind: "battle_invitation",
      payload: { from_name: "Mia", expires_at: "2026-10-30T11:00:00Z" },
    }),
  )!;
  assert.ok(isActionable(live, NOW));
  assert.ok(!isActionable(dead, NOW));
  assert.equal(countUnread([live, dead], NOW), 1);
  assert.equal(countActionable([live, dead], NOW), 1);
});

test("resolved and read items do not count as unread", () => {
  const resolved = parsePostfachItem(
    row({ resolved_at: "2026-10-30T11:00:00Z", resolution: "accepted" }),
  )!;
  const readInfo = parsePostfachItem(
    row({ id: I2, kind: "friend_accepted", read_at: "2026-10-30T11:00:00Z" }),
  )!;
  const newInfo = parsePostfachItem(
    row({ id: I3, kind: "missed_call", payload: { from_name: "Mia", call_kind: "video" } }),
  )!;
  assert.equal(countUnread([resolved, readInfo, newInfo], NOW), 1);
  assert.match(describePostfachItem(newInfo).body, /per Video/);
});

test("battle text describes the settings", () => {
  assert.equal(
    describeBattleSettings({ mode: "timed", durationS: 60, targetReps: 0 }),
    " (1 Min.)",
  );
  assert.equal(
    describeBattleSettings({ mode: "sprint", durationS: 45, targetReps: 0 }),
    " (45 Sek.)",
  );
  assert.equal(
    describeBattleSettings({ mode: "first_to", durationS: 180, targetReps: 30 }),
    " (wer zuerst 30 schafft)",
  );
});

test("findNewItems reports only unseen unresolved items", () => {
  const items = parsePostfachItems([
    row({ id: I1 }),
    row({ id: I2, resolved_at: "2026-10-30T11:00:00Z" }),
    row({ id: I3 }),
  ]);
  assert.deepEqual(
    findNewItems(new Set([I1]), items).map((i) => i.id),
    [I3],
  );
});

test("client lists, marks read and removes through the gateway", async () => {
  const calls: string[] = [];
  const gateway: PostfachGateway = {
    list: async (limit) => {
      calls.push(`list:${limit}`);
      return { data: [row({})], error: null };
    },
    markRead: async (ids, at) => {
      calls.push(`read:${ids.join(",")}:${at}`);
      return { error: null };
    },
    remove: async (ids) => {
      calls.push(`remove:${ids.join(",")}`);
      return { error: null };
    },
  };
  const client = createPostfachClient(gateway);
  assert.equal((await client.list(5000)).length, 1);
  await client.markRead([I1, "bad"], new Date("2026-10-30T12:00:00Z"));
  await client.markRead([]);
  await client.remove([I1]);
  assert.deepEqual(calls, ["list:200", `read:${I1}:2026-10-30T12:00:00.000Z`, `remove:${I1}`]);
});

test("a missing table surfaces as BackendNotReadyError", async () => {
  const client = createPostfachClient({
    list: async () => ({
      data: null,
      error: { code: "PGRST205", message: "Could not find the table" },
    }),
    markRead: async () => ({ error: null }),
    remove: async () => ({ error: null }),
  });
  await assert.rejects(() => client.list(), BackendNotReadyError);
});
