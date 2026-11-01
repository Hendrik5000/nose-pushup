import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { showNotification } from "@/lib/notifications";
import { detectChatMode } from "@/lib/chat-backend";
import { loadChatPrefs } from "@/lib/chat-extras";
import {
  createNexusNotificationPayload,
  shouldAnnounceNexusMessage,
  type NexusNotificationMessage,
} from "@/lib/nexus-notifications";
import { battleInvitationClient } from "@/lib/battle-invitations-runtime";
import { friendsClient, postfachClient } from "@/lib/friends/supabase-friends";
import {
  countActionable,
  countUnread,
  describePostfachItem,
  isActionable,
  type PostfachItem,
} from "@/lib/friends/postfach";
import { BackendNotReadyError } from "@/lib/friends/rpc";
import { BattleInvitationPopup } from "./BattleInvitationPopup";

type PostfachContextValue = {
  items: PostfachItem[];
  unreadCount: number;
  actionableCount: number;
  loading: boolean;
  /** False when the server migrations for the Postfach are not applied (or for guests). */
  available: boolean;
  refresh: () => Promise<void>;
  markRead: (ids: string[]) => Promise<void>;
  respondFriend: (item: PostfachItem, accept: boolean) => Promise<string>;
  respondBattle: (item: PostfachItem, accept: boolean) => Promise<string>;
  openBattle: (item: PostfachItem) => Promise<string>;
  remove: (ids: string[]) => Promise<void>;
};

const PostfachContext = createContext<PostfachContextValue | null>(null);

const EMPTY: PostfachContextValue = {
  items: [],
  unreadCount: 0,
  actionableCount: 0,
  loading: false,
  available: false,
  refresh: async () => undefined,
  markRead: async () => undefined,
  respondFriend: async () => "Nicht verfügbar.",
  respondBattle: async () => "Nicht verfügbar.",
  openBattle: async () => "Nicht verfügbar.",
  remove: async () => undefined,
};

export function usePostfach(): PostfachContextValue {
  return useContext(PostfachContext) ?? EMPTY;
}

const POLL_MS = 30_000;

export function PostfachProvider({
  userId,
  isGuest,
  children,
}: {
  userId: string;
  isGuest: boolean;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const [items, setItems] = useState<PostfachItem[]>([]);
  const [loading, setLoading] = useState(!isGuest);
  const [available, setAvailable] = useState(!isGuest);
  const [popup, setPopup] = useState<PostfachItem | null>(null);
  const known = useRef<Set<string> | null>(null);
  const popupSeen = useRef<Set<string>>(new Set());
  const itemsRef = useRef<PostfachItem[]>([]);
  const inFlight = useRef(false);

  const openBattleById = useCallback(
    async (battleId: string, otherUserId: string): Promise<string> => {
      try {
        const battle = await battleInvitationClient.lookupWaitingBattle(battleId, otherUserId);
        if (!battle) return "Der Warteraum ist nicht mehr verfügbar.";
        await navigate({ to: "/battle/$id", params: { id: battle.id } });
        return "";
      } catch {
        return "Der Warteraum konnte nicht geöffnet werden.";
      }
    },
    [navigate],
  );

  const announce = useCallback(
    (item: PostfachItem, first: boolean) => {
      const { title, body } = describePostfachItem(item);
      if (item.kind === "battle_invitation") {
        if (!popupSeen.current.has(item.id) && isActionable(item) && !item.readAt) {
          popupSeen.current.add(item.id);
          setPopup((current) => current ?? item);
        }
      } else if (!first) {
        if (item.kind === "battle_accepted" && item.battleId && item.fromUserId) {
          const battleId = item.battleId;
          const from = item.fromUserId;
          toast(title, {
            description: body,
            duration: 15_000,
            action: {
              label: "Warteraum öffnen",
              onClick: () => void openBattleById(battleId, from),
            },
          });
        } else {
          toast(title, { description: body });
        }
      }
      if (!first && typeof document !== "undefined" && document.visibilityState === "hidden") {
        void showNotification(title, body, `np-postfach-${item.kind}`, "/postfach");
      }
    },
    [openBattleById],
  );

  const refresh = useCallback(async () => {
    if (isGuest || inFlight.current) return;
    inFlight.current = true;
    try {
      const next = await postfachClient.list();
      itemsRef.current = next;
      setItems(next);
      setAvailable(true);
      const first = known.current === null;
      const previous = known.current ?? new Set<string>();
      for (const item of next) {
        if (previous.has(item.id) || item.resolvedAt) continue;
        if (first && item.kind !== "battle_invitation") continue;
        announce(item, first);
      }
      known.current = new Set(next.map((item) => item.id));
    } catch (error) {
      if (error instanceof BackendNotReadyError) setAvailable(false);
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [announce, isGuest]);

  useEffect(() => {
    if (isGuest) return;
    void refresh();
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => void refresh(), 250);
    };
    const channel = supabase
      .channel(`postfach-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "postfach_items", filter: `user_id=eq.${userId}` },
        schedule,
      )
      .subscribe();
    const interval = setInterval(() => void refresh(), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", schedule);
    window.addEventListener("online", schedule);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(debounce);
      clearInterval(interval);
      window.removeEventListener("focus", schedule);
      window.removeEventListener("online", schedule);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [isGuest, refresh, userId]);

  useEffect(() => {
    if (isGuest) return;
    let cancelled = false;
    let closeChannel: (() => void) | null = null;
    const seenMessageIds = new Set<string>();

    void detectChatMode().then((mode) => {
      if (cancelled || mode !== "supabase") return;
      const channel = supabase
        .channel(`nexus-message-notifications-${userId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages" },
          (event) => {
            const message = event.new as unknown as NexusNotificationMessage;
            if (!message.id || seenMessageIds.has(message.id)) return;
            seenMessageIds.add(message.id);
            if (seenMessageIds.size > 500) {
              const oldestId = seenMessageIds.values().next().value;
              if (oldestId) seenMessageIds.delete(oldestId);
            }

            const visibleInNexus =
              document.visibilityState === "visible" && window.location.pathname === "/chat";
            if (
              !shouldAnnounceNexusMessage({
                message,
                userId,
                mutedRoomIds: loadChatPrefs(userId).mutedRoomIds,
                isTargetVisible: visibleInNexus,
              })
            )
              return;
            const notification = createNexusNotificationPayload(message);
            if (!notification) return;

            if (document.visibilityState === "hidden") {
              void showNotification(
                notification.title,
                notification.body,
                notification.tag,
                notification.url,
              );
              return;
            }

            const openTarget = () => {
              if (message.conversation_id) {
                void navigate({ to: "/chat", search: { dm: message.conversation_id } });
              } else {
                void navigate({ to: "/chat" });
              }
            };
            toast(notification.title, {
              description: notification.body,
              duration: 10_000,
              action: { label: "Öffnen", onClick: openTarget },
            });
          },
        )
        .subscribe();
      closeChannel = () => void supabase.removeChannel(channel);
    });

    return () => {
      cancelled = true;
      closeChannel?.();
    };
  }, [isGuest, navigate, userId]);

  const markRead = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      const now = new Date().toISOString();
      setItems((current) =>
        current.map((item) =>
          ids.includes(item.id) && !item.readAt ? { ...item, readAt: now } : item,
        ),
      );
      try {
        await postfachClient.markRead(ids);
      } catch {
        await refresh();
      }
    },
    [refresh],
  );

  const remove = useCallback(
    async (ids: string[]) => {
      setItems((current) => current.filter((item) => !ids.includes(item.id)));
      try {
        await postfachClient.remove(ids);
      } catch {
        await refresh();
      }
    },
    [refresh],
  );

  const respondFriend = useCallback(
    async (item: PostfachItem, accept: boolean): Promise<string> => {
      if (!item.refId) return "Diese Einladung ist nicht mehr gültig.";
      try {
        const result = await friendsClient.respond(item.refId, accept);
        await refresh();
        if (result === "stale") return "Diese Einladung ist nicht mehr offen.";
        return result === "accepted"
          ? `Du und ${item.fromName} seid jetzt Freunde.`
          : "Einladung abgelehnt.";
      } catch {
        return "Die Antwort konnte nicht gesendet werden. Versuche es erneut.";
      }
    },
    [refresh],
  );

  const respondBattle = useCallback(
    async (item: PostfachItem, accept: boolean): Promise<string> => {
      if (!item.refId || !item.fromUserId) return "Diese Einladung ist nicht mehr gültig.";
      try {
        const response = await battleInvitationClient.respondToInvitation(
          item.refId,
          item.fromUserId,
          accept,
        );
        await refresh();
        if (response.result === "accepted" && response.battleId) {
          const failure = await openBattleById(response.battleId, item.fromUserId);
          return failure;
        }
        if (response.result === "declined") return "Battle abgelehnt.";
        return "Diese Einladung ist nicht mehr offen oder abgelaufen.";
      } catch {
        await refresh();
        return "Die Antwort konnte nicht verarbeitet werden. Prüfe den Status im Postfach.";
      }
    },
    [openBattleById, refresh],
  );

  const openBattle = useCallback(
    async (item: PostfachItem): Promise<string> => {
      if (!item.battleId || !item.fromUserId) return "Der Warteraum ist nicht mehr verfügbar.";
      return openBattleById(item.battleId, item.fromUserId);
    },
    [openBattleById],
  );

  const value = useMemo<PostfachContextValue>(
    () => ({
      items,
      unreadCount: countUnread(items),
      actionableCount: countActionable(items),
      loading,
      available,
      refresh,
      markRead,
      respondFriend,
      respondBattle,
      openBattle,
      remove,
    }),
    [
      available,
      items,
      loading,
      markRead,
      openBattle,
      refresh,
      remove,
      respondBattle,
      respondFriend,
    ],
  );

  const closePopup = useCallback(
    (later: boolean) => {
      const current = popup;
      setPopup(null);
      if (current && later) void markRead([current.id]);
    },
    [markRead, popup],
  );

  // Show the next unseen invitation after the current popup closed.
  useEffect(() => {
    if (popup) return;
    const next = items.find(
      (item) =>
        item.kind === "battle_invitation" &&
        isActionable(item) &&
        !item.readAt &&
        !popupSeen.current.has(item.id),
    );
    if (next) {
      popupSeen.current.add(next.id);
      setPopup(next);
    }
  }, [items, popup]);

  // Drop the popup when the invitation was answered elsewhere.
  useEffect(() => {
    if (!popup) return;
    const latest = items.find((item) => item.id === popup.id);
    if (latest && !isActionable(latest)) setPopup(null);
  }, [items, popup]);

  return (
    <PostfachContext.Provider value={value}>
      {children}
      <BattleInvitationPopup
        item={popup}
        onAnswer={async (accept) => {
          if (!popup) return "";
          const item = popup;
          const message = await respondBattle(item, accept);
          setPopup(null);
          return message;
        }}
        onLater={() => closePopup(true)}
      />
    </PostfachContext.Provider>
  );
}
