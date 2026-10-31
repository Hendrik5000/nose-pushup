export type NexusNotificationMessage = {
  id: string;
  user_id: string;
  room_id: string | null;
  conversation_id: string | null;
  attachment_type?: string | null;
};

export type NexusNotificationPayload = {
  title: string;
  body: string;
  url: string;
  tag: string;
};

/** Build a generic notification without exposing private message content. */
export function createNexusNotificationPayload(
  message: NexusNotificationMessage,
): NexusNotificationPayload | null {
  const hasRoom = Boolean(message.room_id);
  const hasConversation = Boolean(message.conversation_id);
  if (!message.id || hasRoom === hasConversation) return null;

  return {
    title: "Neue Nachricht in Nexus",
    body: hasConversation
      ? "Du hast eine neue Direktnachricht."
      : "Es gibt eine neue Nachricht im Nexus Chat.",
    url: hasConversation ? `/chat?dm=${encodeURIComponent(message.conversation_id!)}` : "/chat",
    tag: `np-nexus-${message.id}`,
  };
}

/** Return unique conversation members except the sender. */
export function getNexusConversationRecipients(
  memberIds: readonly string[],
  senderId: string,
): string[] {
  return Array.from(
    new Set(memberIds.filter((userId) => userId.length > 0 && userId !== senderId)),
  );
}

/** Suppress self-notifications, muted-room alerts, and alerts for the visible target. */
export function shouldAnnounceNexusMessage(options: {
  message: NexusNotificationMessage;
  userId: string;
  mutedRoomIds: readonly string[];
  isTargetVisible: boolean;
}): boolean {
  const { message, userId, mutedRoomIds, isTargetVisible } = options;
  const hasRoom = Boolean(message.room_id);
  const hasConversation = Boolean(message.conversation_id);
  if (!message.id || !message.user_id || message.user_id === userId) return false;
  if (hasRoom === hasConversation || isTargetVisible) return false;
  if (message.room_id && mutedRoomIds.includes(message.room_id)) return false;
  return true;
}
