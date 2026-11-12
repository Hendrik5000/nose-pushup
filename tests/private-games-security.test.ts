import assert from "node:assert/strict";
import { test } from "node:test";
import { withAdminGameAccess } from "../src/lib/private-game-policy";

test("an authenticated admin receives the requested private game document", async () => {
  let roleChecks = 0;
  let documentLoads = 0;
  const document = await withAdminGameAccess(
    false,
    async () => {
      roleChecks += 1;
      return { data: true, error: null };
    },
    () => {
      documentLoads += 1;
      return "admin-only-game-payload";
    },
  );

  assert.equal(document, "admin-only-game-payload");
  assert.equal(roleChecks, 1);
  assert.equal(documentLoads, 1);
});

test("a signed-in non-admin cannot load the game document", async () => {
  let documentLoads = 0;
  await assert.rejects(
    withAdminGameAccess(
      false,
      async () => ({ data: false, error: null }),
      () => {
        documentLoads += 1;
        return "must-not-leak";
      },
    ),
    /Not authorized/,
  );
  assert.equal(documentLoads, 0);
});

test("anonymous users are rejected before the role RPC or document loader runs", async () => {
  for (const claim of [true, "true"]) {
    let roleChecks = 0;
    let documentLoads = 0;
    await assert.rejects(
      withAdminGameAccess(
        claim,
        async () => {
          roleChecks += 1;
          return { data: true, error: null };
        },
        () => {
          documentLoads += 1;
          return "must-not-leak";
        },
      ),
      /Not authorized/,
    );
    assert.equal(roleChecks, 0);
    assert.equal(documentLoads, 0);
  }
});

test("role RPC errors and thrown failures deny access without exposing a document", async () => {
  const checks = [
    async () => ({ data: true, error: new Error("role service unavailable") }),
    async () => {
      throw new Error("network unavailable");
    },
  ];
  for (const check of checks) {
    let documentLoads = 0;
    await assert.rejects(
      withAdminGameAccess(false, check, () => {
        documentLoads += 1;
        return "must-not-leak";
      }),
      /Not authorized/,
    );
    assert.equal(documentLoads, 0);
  }
});
