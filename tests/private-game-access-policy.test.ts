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

function grantedUser(userId: string): PrivateGameAccessState {
  return resolveCheck(createPrivateGameAccessState(userId), userId, true);
}

test("logout immediately invalidates account access and an already-rendered game lease", () => {
  const accountState = grantedUser("account-a");
  const document = {
    userId: "account-a",
    game: "grid-defense" as const,
    revision: accountState.revision,
    document: "private-game-html",
  };
  assert.equal(hasPrivateGameAccessForUser(accountState, "account-a"), true);
  assert.equal(
    isCurrentPrivateGameDocument(document, "account-a", "grid-defense", accountState),
    true,
  );

  const loggedOut = reducePrivateGameAccess(accountState, {
    type: "auth-change",
    userId: null,
  });
  assert.equal(loggedOut.status, "denied");
  assert.equal(hasPrivateGameAccessForUser(loggedOut, "account-a"), false);
  assert.equal(
    isCurrentPrivateGameDocument(document, "account-a", "grid-defense", loggedOut),
    false,
  );
});

test("switching accounts clears old access before allowing any newly checked account", () => {
  const accountState = grantedUser("account-a");
  const nextAccountChecking = reducePrivateGameAccess(accountState, {
    type: "auth-change",
    userId: "member-b",
  });
  assert.equal(hasPrivateGameAccessForUser(nextAccountChecking, "account-a"), false);
  assert.equal(hasPrivateGameAccessForUser(nextAccountChecking, "member-b"), false);

  const memberAllowed = resolveCheck(nextAccountChecking, "member-b", true);
  assert.equal(memberAllowed.status, "allowed");
  assert.equal(hasPrivateGameAccessForUser(memberAllowed, "member-b"), true);
  assert.equal(hasPrivateGameAccessForUser(memberAllowed, "account-a"), false);
});

test("a failed session recheck immediately invalidates the open game document", () => {
  const accountState = grantedUser("account-a");
  const document = {
    userId: "account-a",
    game: "kupferkern" as const,
    revision: accountState.revision,
    document: "private-game-html",
  };
  assert.equal(
    isCurrentPrivateGameDocument(document, "account-a", "kupferkern", accountState),
    true,
  );

  const revalidating = reducePrivateGameAccess(accountState, {
    type: "recheck",
    userId: "account-a",
  });
  assert.equal(revalidating.status, "checking");
  assert.equal(
    isCurrentPrivateGameDocument(document, "account-a", "kupferkern", revalidating),
    false,
  );

  const revoked = resolveCheck(revalidating, "account-a", false);
  assert.equal(revoked.status, "denied");
  assert.equal(hasPrivateGameAccessForUser(revoked, "account-a"), false);
  assert.equal(isCurrentPrivateGameDocument(document, "account-a", "kupferkern", revoked), false);
});

test("a pending session check fails closed while an existing game lease is revalidated", () => {
  const accountState = grantedUser("account-a");
  const document = {
    userId: "account-a",
    game: "grid-defense" as const,
    revision: accountState.revision,
    document: "private-game-html",
  };
  const requestId = accountState.requestId + 1;
  const checking = reducePrivateGameAccess(accountState, {
    type: "check-start",
    userId: "account-a",
    revision: accountState.revision,
    requestId,
  });

  assert.equal(checking.status, "checking");
  assert.equal(hasPrivateGameAccessForUser(checking, "account-a"), false);
  assert.equal(
    isCurrentPrivateGameDocument(document, "account-a", "grid-defense", checking),
    false,
  );

  const denied = reducePrivateGameAccess(checking, {
    type: "check-result",
    userId: "account-a",
    revision: checking.revision,
    requestId,
    allowed: false,
  });
  assert.equal(denied.status, "denied");
  assert.equal(isCurrentPrivateGameDocument(document, "account-a", "grid-defense", denied), false);
});

test("a late response from the previous account cannot restore access or replace the current result", () => {
  let state = grantedUser("account-a");
  const oldRevision = state.revision;
  const oldRequestId = state.requestId + 1;
  state = reducePrivateGameAccess(state, {
    type: "check-start",
    userId: "account-a",
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
    allowed: true,
  });
  const currentAllowedState = state;

  state = reducePrivateGameAccess(state, {
    type: "check-result",
    userId: "account-a",
    revision: oldRevision,
    requestId: oldRequestId,
    allowed: true,
  });
  assert.deepEqual(state, currentAllowedState);
  assert.notDeepEqual(state, switched);
  assert.equal(hasPrivateGameAccessForUser(state, "member-b"), true);
  assert.equal(hasPrivateGameAccessForUser(state, "account-a"), false);
});
