import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  createFriendAppSharesClient,
  FRIEND_APP_SHARES_MAX,
  parseFriendAppShareRow,
  parseFriendAppShareRows,
  type FriendAppSharesGateway,
} from "../src/lib/friend-app-shares";

const VALID_MANIFEST = {
  schemaVersion: 1,
  name: "Trainingsstart",
  description: "Öffnet den vorhandenen Trainingsbereich.",
  icon: "training",
  blocks: [
    { type: "heading", text: "Los geht's" },
    { type: "action", label: "Trainingsprogramme", actionId: "route:/programs" },
  ],
};

function validRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "share-1",
    sharer_id: "user-1",
    session_id: "session-1",
    app_name: "Trainingsstart",
    manifest: VALID_MANIFEST,
    created_at: "2026-11-17T10:00:00.000Z",
    ...overrides,
  };
}

test("friend app share rows parse, dedupe and skip invalid rows", () => {
  const share = parseFriendAppShareRow(validRow());
  assert.ok(share);
  assert.equal(share.id, "share-1");
  assert.equal(share.sharerId, "user-1");
  assert.equal(share.sessionId, "session-1");
  assert.equal(share.appName, "Trainingsstart");
  assert.equal(share.manifest.name, "Trainingsstart");

  assert.equal(parseFriendAppShareRow(null), null);
  assert.equal(parseFriendAppShareRow("nope"), null);
  assert.equal(parseFriendAppShareRow(validRow({ id: "  " })), null);
  assert.equal(parseFriendAppShareRow(validRow({ session_id: "" })), null);
  assert.equal(parseFriendAppShareRow(validRow({ manifest: { name: "kaputt" } })), null);

  const rows = [
    validRow(),
    validRow({ id: "share-2", created_at: "2026-11-16T10:00:00.000Z" }),
    validRow(),
    validRow({ id: "share-3", app_name: "" }),
    "garbage",
  ];
  const parsed = parseFriendAppShareRows(rows);
  assert.deepEqual(
    parsed.map((entry) => entry.id),
    ["share-1", "share-2"],
  );
  assert.equal(parseFriendAppShareRows(null).length, 0);
  assert.equal(parseFriendAppShareRows("nope").length, 0);
});

test("friend app share rows sort newest first and cap at FRIEND_APP_SHARES_MAX", () => {
  const rows = Array.from({ length: FRIEND_APP_SHARES_MAX + 10 }, (_, index) =>
    validRow({
      id: `share-${index}`,
      created_at: new Date(Date.UTC(2026, 10, 1, 0, 0, index)).toISOString(),
    }),
  );
  const parsed = parseFriendAppShareRows(rows);
  assert.equal(parsed.length, FRIEND_APP_SHARES_MAX);
  assert.equal(parsed[0].id, `share-${FRIEND_APP_SHARES_MAX + 9}`);
});

type FakeResult = PromiseLike<{ data: unknown; error: { message: string } | null }>;

function fakeGateway(overrides: Partial<FriendAppSharesGateway> = {}): {
  gateway: FriendAppSharesGateway;
  inserted: Record<string, unknown>[];
  removed: string[];
} {
  const inserted: Record<string, unknown>[] = [];
  const removed: string[] = [];
  const gateway: FriendAppSharesGateway = {
    list: () => Promise.resolve({ data: [validRow()], error: null }) as FakeResult,
    insert: (values) => {
      inserted.push(values);
      return Promise.resolve({ error: null }) as FakeResult;
    },
    remove: (id) => {
      removed.push(id);
      return Promise.resolve({ error: null }) as FakeResult;
    },
    ...overrides,
  };
  return { gateway, inserted, removed };
}

test("friend app shares client lists, shares and unshares via the gateway", async () => {
  const { gateway, inserted, removed } = fakeGateway();
  const client = createFriendAppSharesClient(gateway);

  const shares = await client.listShares();
  assert.equal(shares.length, 1);
  assert.equal(shares[0].sessionId, "session-1");

  await client.shareDraft({
    sessionId: "session-9",
    appName: "Trainingsstart",
    manifest: VALID_MANIFEST,
  });
  assert.deepEqual(inserted, [
    {
      session_id: "session-9",
      app_name: "Trainingsstart",
      manifest: VALID_MANIFEST,
    },
  ]);

  await client.unshare("share-1");
  assert.deepEqual(removed, ["share-1"]);
});

test("friend app shares client surfaces honest german errors", async () => {
  const failingList = fakeGateway({
    list: () => Promise.resolve({ data: null, error: { message: "kaputt" } }) as FakeResult,
  });
  const failingClient = createFriendAppSharesClient(failingList.gateway);
  await assert.rejects(
    () => failingClient.listShares(),
    /Freundes-Apps konnten nicht geladen werden: kaputt/,
  );

  const client = createFriendAppSharesClient(fakeGateway().gateway);
  await assert.rejects(
    () =>
      client.shareDraft({
        sessionId: "session-1",
        appName: "Trainingsstart",
        manifest: { name: "kaputt" },
      }),
    Error,
  );
  await assert.rejects(
    () => client.shareDraft({ sessionId: "  ", appName: "x", manifest: VALID_MANIFEST }),
    /Entwurf unvollständig/,
  );

  const failingRemove = fakeGateway({
    remove: () => Promise.resolve({ error: { message: "weg" } }) as FakeResult,
  });
  await assert.rejects(
    () => createFriendAppSharesClient(failingRemove.gateway).unshare("share-1"),
    /Teilen konnte nicht beendet werden: weg/,
  );
  await assert.rejects(
    () => createFriendAppSharesClient(fakeGateway().gateway).unshare("   "),
    /Freigabe unbekannt/,
  );
});

test("the friend_app_shares migration ships RLS for owner and accepted friends", () => {
  const sql = readFileSync("supabase/migrations/20261117150000_friend_app_shares.sql", "utf8");
  assert.match(sql, /CREATE TABLE public\.friend_app_shares/);
  assert.match(sql, /sharer_id uuid NOT NULL REFERENCES auth\.users\(id\) ON DELETE CASCADE/);
  assert.match(sql, /UNIQUE \(sharer_id, session_id\)/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /CREATE POLICY "Sharers manage their own app shares"/);
  assert.match(sql, /WITH CHECK \(sharer_id = auth\.uid\(\)\)/);
  assert.match(sql, /CREATE POLICY "Accepted friends see shared apps"/);
  assert.match(sql, /FROM public\.friendships f/);
  assert.match(sql, /f\.status = 'accepted'/);
  assert.match(sql, /GRANT SELECT, INSERT, DELETE ON public\.friend_app_shares TO authenticated/);
});

test("marketplace and mira drafts panels wire the friend shares UI", () => {
  const catalog = readFileSync("src/components/marketplace/MarketplaceAppCatalog.tsx", "utf8");
  assert.match(catalog, /userId\?: string \| null/);
  assert.match(catalog, /FriendAppSharesSection/);

  const route = readFileSync("src/routes/marketplace.tsx", "utf8");
  assert.match(route, /userId=\{userId\}/);

  const section = readFileSync("src/components/marketplace/FriendAppSharesSection.tsx", "utf8");
  assert.match(section, /loadFriendEntries/);
  assert.match(section, /friend-share:\$\{selected\.id\}/);
  assert.match(section, /MarketplaceManifestView/);

  const panel = readFileSync("src/components/mira/MiraMarketplaceDraftsPanel.tsx", "utf8");
  assert.match(panel, /Teilen beenden/);
  assert.match(panel, /shareDraft/);

  const drafts = readFileSync("src/lib/mira-marketplace-drafts.ts", "utf8");
  assert.match(drafts, /export function getMiraMarketplaceDraftManifest/);
});
