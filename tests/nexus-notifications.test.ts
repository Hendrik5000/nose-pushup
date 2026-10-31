import assert from "node:assert/strict";
import test from "node:test";
import {
  createNexusNotificationPayload,
  getNexusConversationRecipients,
  shouldAnnounceNexusMessage,
  type NexusNotificationMessage,
} from "../src/lib/nexus-notifications";

const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const MESSAGE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CONVERSATION = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ROOM = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const directMessage: NexusNotificationMessage = {
  id: MESSAGE,
  user_id: OTHER,
  room_id: null,
  conversation_id: CONVERSATION,
  attachment_type: null,
};

function shouldAnnounce(
  message: NexusNotificationMessage,
  options: { userId?: string; mutedRoomIds?: string[]; isTargetVisible?: boolean } = {},
) {
  return shouldAnnounceNexusMessage({
    message,
    userId: options.userId ?? USER,
    mutedRoomIds: options.mutedRoomIds ?? [],
    isTargetVisible: options.isTargetVisible ?? false,
  });
}

test("DM notifications use a deep link and do not expose message contents", () => {
  const payload = createNexusNotificationPayload(directMessage);
  assert.ok(payload);
  assert.equal(payload.title, "Neue Nachricht in Nexus");
  assert.equal(payload.body, "Du hast eine neue Direktnachricht.");
  assert.equal(payload.url, `/chat?dm=${CONVERSATION}`);
  assert.equal(payload.tag, `np-nexus-${MESSAGE}`);
  assert.doesNotMatch(JSON.stringify(payload), /geheime Nachricht|Private Nachricht/i);
});

test("room notifications open Nexus without broadcasting to every room member", () => {
  const roomMessage = { ...directMessage, room_id: ROOM, conversation_id: null };
  const payload = createNexusNotificationPayload(roomMessage);
  assert.ok(payload);
  assert.equal(payload.url, "/chat");
  assert.equal(payload.body, "Es gibt eine neue Nachricht im Nexus Chat.");
  assert.equal(shouldAnnounce(roomMessage), true);
  assert.equal(shouldAnnounce(roomMessage, { mutedRoomIds: [ROOM] }), false);
});

test("conversation push recipients exclude the sender and duplicate members", () => {
  assert.deepEqual(getNexusConversationRecipients([USER, OTHER, OTHER, ""], USER), [OTHER]);
});

test("self messages, malformed targets, and the currently visible target are suppressed", () => {
  assert.equal(shouldAnnounce({ ...directMessage, user_id: USER }), false);
  assert.equal(shouldAnnounce(directMessage, { isTargetVisible: true }), false);
  assert.equal(
    createNexusNotificationPayload({ ...directMessage, room_id: null, conversation_id: null }),
    null,
  );
  assert.equal(createNexusNotificationPayload({ ...directMessage, room_id: ROOM }), null);
});
