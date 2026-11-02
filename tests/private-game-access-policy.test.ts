import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createPrivateGameAccessState,
  hasPrivateGameAccessForUser,
  isCurrentPrivateGameDocument,
  reducePrivateGameAccess,
  type PrivateGameAccessState,
} from "../src/lib/private-game-access-policy";

function resolveCheck(
  state: PrivateGameAccessState,
  userId: string,
  allowed: boolean,
): PrivateGameAccessState {
  const requestId = state.requestId + 1;
  const started = reducePrivateGameAccess(state, {
    type: "check-start",
    userId,
    revision: state.revision,
    requestId,
  });
  return reducePrivateGameAccess(started, {
    type: "check-result",
    userId,
    revision: state.revision,
    requestId,
    allowed,
  });
}

function grantedAdmin(userId: string): PrivateGameAccessState {
  return resolveCheck(createPrivateGameAccessState(userId), userId, true);
}

test("logout immediately invalidates Admin access and an already-rendered game lease", () => {
  const adminState = grantedAdmin("admin-a");
  const document = {
    userId: "admin-a",
    game: "grid-defense" as const,
    revision: adminState.revision,
    document: "private-game-html",
  };
  assert.equal(hasPrivateGameAccessForUser(adminState, "admin-a"), true);
  assert.equal(isCurrentPrivateGameDocument(document, "admin-a", "grid-defense", adminState), true);

  const loggedOut = reducePrivateGameAccess(adminState, {
    type: "auth-change",
    userId: null,
  });
  assert.equal(loggedOut.status, "denied");
  assert.equal(hasPrivateGameAccessForUser(loggedOut, "admin-a"), false);
  assert.equal(isCurrentPrivateGameDocument(document, "admin-a", "grid-defense", loggedOut), false);
});

test("switching from an Admin to a non-Admin account clears access before the new check completes", () => {
  const adminState = grantedAdmin("admin-a");
  const nonAdminChecking = reducePrivateGameAccess(adminState, {
    type: "auth-change",
    userId: "member-b",
  });
  assert.equal(hasPrivateGameAccessForUser(nonAdminChecking, "admin-a"), false);
  assert.equal(hasPrivateGameAccessForUser(nonAdminChecking, "member-b"), false);

  const nonAdminDenied = resolveCheck(nonAdminChecking, "member-b", false);
  assert.equal(nonAdminDenied.status, "denied");
  assert.equal(hasPrivateGameAccessForUser(nonAdminDenied, "member-b"), false);
});

test("a role-loss result immediately invalidates the open game document", () => {
  const adminState = grantedAdmin("admin-a");
  const document = {
    userId: "admin-a",
    game: "kupferkern" as const,
    revision: adminState.revision,
    document: "private-game-html",
  };
  assert.equal(isCurrentPrivateGameDocument(document, "admin-a", "kupferkern", adminState), true);

  const revalidating = reducePrivateGameAccess(adminState, {
    type: "recheck",
    userId: "admin-a",
  });
  assert.equal(revalidating.status, "checking");
  assert.equal(
    isCurrentPrivateGameDocument(document, "admin-a", "kupferkern", revalidating),
    false,
  );

  const revoked = resolveCheck(revalidating, "admin-a", false);
  assert.equal(revoked.status, "denied");
  assert.equal(hasPrivateGameAccessForUser(revoked, "admin-a"), false);
  assert.equal(isCurrentPrivateGameDocument(document, "admin-a", "kupferkern", revoked), false);
});

test("a late Admin response from the previous account cannot restore access or replace the current result", () => {
  let state = grantedAdmin("admin-a");
  const oldRevision = state.revision;
  const oldRequestId = state.requestId + 1;
  state = reducePrivateGameAccess(state, {
    type: "check-start",
    userId: "admin-a",
    revision: oldRevision,
    requestId: oldRequestId,
  });

  state = reducePrivateGameAccess(state, { type: "auth-change", userId: "member-b" });
  const switched = state;
  const newRequestId = state.requestId + 1;
  state = reducePrivateGameAccess(state, {
    type: "check-start",
    userId: "member-b",
    revision: state.revision,
    requestId: newRequestId,
  });
  state = reducePrivateGameAccess(state, {
    type: "check-result",
    userId: "member-b",
    revision: state.revision,
    requestId: newRequestId,
    allowed: false,
  });
  const currentDeniedState = state;

  state = reducePrivateGameAccess(state, {
    type: "check-result",
    userId: "admin-a",
    revision: oldRevision,
    requestId: oldRequestId,
    allowed: true,
  });
  assert.deepEqual(state, currentDeniedState);
  assert.notDeepEqual(state, switched);
  assert.equal(hasPrivateGameAccessForUser(state, "member-b"), false);
  assert.equal(hasPrivateGameAccessForUser(state, "admin-a"), false);
});
