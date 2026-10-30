/** Enabled together with the Postfach. If the server migration is missing the UI shows a clear "not set up" message. */
export const BATTLE_INVITATIONS_UI_ENABLED = true as const;

export type BattleInvitationGateInput = {
  migrationVerified: boolean;
  isRegisteredAccount: boolean;
  isAcceptedFriend: boolean;
};

export type BattleInvitationGateReason =
  "migration-unverified" | "registered-account-required" | "accepted-friend-required" | "ready";

/** Fail-closed model for the future friend picker; this does not perform I/O. */
export function getBattleInvitationGateReason(
  input: BattleInvitationGateInput,
): BattleInvitationGateReason {
  if (!input.migrationVerified) return "migration-unverified";
  if (!input.isRegisteredAccount) return "registered-account-required";
  if (!input.isAcceptedFriend) return "accepted-friend-required";
  return "ready";
}

export type BattleInvitationDecisionInput = {
  migrationVerified: boolean;
  isRecipient: boolean;
  status: "pending" | "accepted" | "declined" | "cancelled" | "expired";
  expiresAt: string;
  friendshipStillAccepted: boolean;
  now?: Date;
};

/** Only the current recipient can answer a live pending invite from a friend. */
export function canRespondToBattleInvitation(input: BattleInvitationDecisionInput): boolean {
  if (!input.migrationVerified || !input.isRecipient || input.status !== "pending") return false;
  if (!input.friendshipStillAccepted) return false;
  const expiry = Date.parse(input.expiresAt);
  const now = input.now?.getTime() ?? Date.now();
  return Number.isFinite(expiry) && expiry > now;
}
