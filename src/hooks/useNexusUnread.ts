import { useEffect, useState } from "react";
import {
  detectChatMode,
  loadChatStore,
  loadRoomPreview,
  loadRoomsForUser,
} from "@/lib/chat-backend";
import { aggregateUnread, loadChatPrefs } from "@/lib/chat-extras";
import { messagesFor } from "@/lib/local-chat";
import { sumKnownUnread } from "@/lib/home-day-widgets";

/**
 * Total unread Nexus Chat messages across rooms and DMs, or null when the
 * count is unknown (errors, unavailable backend). No badge is shown for null.
 */
export function useNexusUnread(userId: string): number | null {
  const [unread, setUnread] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setUnread(null);
    void (async () => {
      try {
        const prefs = loadChatPrefs(userId);
        if ((await detectChatMode()) === "local") {
          const store = loadChatStore(userId);
          const targets = [
            ...store.rooms.map((room) => ({
              kind: "room" as const,
              id: room.id,
              messages: messagesFor(store, { kind: "room", id: room.id }),
            })),
            ...store.dms.map((dm) => ({
              kind: "dm" as const,
              id: dm.id,
              messages: messagesFor(store, { kind: "dm", id: dm.id }),
            })),
          ];
          if (!cancelled) setUnread(aggregateUnread(prefs, targets, userId).total);
          return;
        }
        const rooms = await loadRoomsForUser(userId);
        const previews: Record<string, { unread: number | null }> = {};
        let index = 0;
        const loadNext = async () => {
          while (!cancelled && index < rooms.length) {
            const room = rooms[index++];
            try {
              const preview = await loadRoomPreview(
                userId,
                room.id,
                prefs.lastRead[`room:${room.id}`],
              );
              if (!cancelled) previews[room.id] = { unread: preview.unread };
            } catch {
              if (!cancelled) previews[room.id] = { unread: null };
            }
          }
        };
        await Promise.all(Array.from({ length: Math.min(4, rooms.length) }, loadNext));
        if (!cancelled) setUnread(sumKnownUnread(previews));
      } catch {
        if (!cancelled) setUnread(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return unread;
}
