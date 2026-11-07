import assert from "node:assert/strict";
import test from "node:test";
import { aggregateUnread, type ChatPrefs } from "../src/lib/chat-extras";

const prefs: ChatPrefs = {
  mutedRoomIds: [],
  favoriteRoomIds: [],
  pinnedMessageIds: [],
  lastRead: { "room:alpha": "2026-01-02T00:00:00.000Z", "dm:beta": "2026-01-03T00:00:00.000Z" },
};

test("aggregates unread incoming messages per room and DM using last-read timestamps", () => {
  const result = aggregateUnread(
    prefs,
    [
      {
        kind: "room",
        id: "alpha",
        messages: [
          { created_at: "2026-01-01T12:00:00.000Z", user_id: "other" },
          { created_at: "2026-01-02T00:00:00.000Z", user_id: "other" },
          { created_at: "2026-01-02T00:01:00.000Z", user_id: "me" },
          { created_at: "2026-01-02T00:02:00.000Z", user_id: "other" },
        ],
      },
      {
        kind: "dm",
        id: "beta",
        messages: [
          { created_at: "2026-01-03T00:01:00.000Z", user_id: "other" },
          { created_at: "2026-01-04T00:00:00.000Z", user_id: "me" },
          { created_at: "2026-01-05T00:00:00.000Z", user_id: "other" },
        ],
      },
    ],
    "me",
  );

  assert.equal(result.total, 3);
  assert.deepEqual(
    result.targets.map(({ kind, id, unread }) => ({ kind, id, unread })),
    [
      { kind: "room", id: "alpha", unread: 1 },
      { kind: "dm", id: "beta", unread: 2 },
    ],
  );
});

test("empty targets and empty message lists contribute zero", () => {
  const result = aggregateUnread(
    { ...prefs, lastRead: {} },
    [
      { kind: "room", id: "empty", messages: [] },
      {
        kind: "dm",
        id: "populated",
        messages: [{ created_at: "2026-01-01T00:00:00.000Z", user_id: "me" }],
      },
    ],
    "me",
  );
  assert.equal(result.total, 0);
  assert.deepEqual(
    result.targets.map((target) => target.unread),
    [0, 0],
  );
});
