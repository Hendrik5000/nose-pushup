import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { FriendCodeCard } from "@/components/friends/FriendCodeCard";
import { useCalls } from "@/components/calls/CallProvider";
import { usePostfach } from "@/components/postfach/PostfachProvider";
import { loadFriendEntries, friendsClient, removeFriendship } from "@/lib/friends/supabase-friends";
import { openCloudDm } from "@/lib/nexus-cloud";
import type { FriendEntry, SentFriendRequest } from "@/lib/friends/friends-client";
import { BackendNotReadyError } from "@/lib/friends/rpc";

type Tab = "friends" | "code" | "sent";

export function FriendsPanel({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const calls = useCalls();
  const postfach = usePostfach();
  const [tab, setTab] = useState<Tab>("friends");
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [sent, setSent] = useState<SentFriendRequest[]>([]);
  const [sentError, setSentError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setFriends(await loadFriendEntries(userId));
    } catch {
      setFriends([]);
    }
    try {
      setSent(await friendsClient.listSent());
      setSentError(null);
    } catch (error) {
      setSent([]);
      setSentError(
        error instanceof BackendNotReadyError
          ? "Einladungen per Code sind auf dem Server noch nicht eingerichtet."
          : null,
      );
    }
    setLoading(false);
  }, [userId]);

  // A friend request that was just accepted or declined changes both lists.
  const postfachSignature = postfach.items
    .map((item) => `${item.id}:${item.resolvedAt ?? ""}`)
    .join("|");
  useEffect(() => {
    void load();
  }, [load, postfachSignature]);

  const withdraw = async (request: SentFriendRequest) => {
    setBusy(request.friendshipId);
    try {
      await friendsClient.withdraw(request.friendshipId);
    } catch {
      toast("Die Einladung konnte nicht zurückgezogen werden.");
    }
    setBusy(null);
    void load();
  };

  const remove = async (friend: FriendEntry) => {
    setBusy(friend.friendshipId);
    const ok = await removeFriendship(friend.friendshipId);
    if (!ok) toast("Der Freund konnte nicht entfernt werden.");
    setConfirmRemove(null);
    setBusy(null);
    void load();
  };

  const message = async (friend: FriendEntry) => {
    setBusy(friend.friendshipId);
    try {
      const id = await openCloudDm(friend.id);
      await navigate({ to: "/chat", search: { dm: id } });
    } catch (error) {
      toast(
        error instanceof BackendNotReadyError
          ? "Freunde-Chat ist auf dem Server noch nicht eingerichtet."
          : "Die Direktnachricht konnte nicht geöffnet werden.",
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <div
        role="tablist"
        aria-label="Freunde"
        className="flex overflow-x-auto rounded-full border border-border bg-background/60 p-0.5 text-[10px] uppercase tracking-[0.18em]"
      >
        <TabBtn active={tab === "friends"} onClick={() => setTab("friends")}>
          Freunde
        </TabBtn>
        <TabBtn active={tab === "code"} onClick={() => setTab("code")}>
          Code
        </TabBtn>
        <TabBtn active={tab === "sent"} onClick={() => setTab("sent")}>
          Gesendet {sent.length > 0 && `(${sent.length})`}
        </TabBtn>
      </div>

      {postfach.available && postfach.actionableCount > 0 && (
        <button
          type="button"
          onClick={() => void navigate({ to: "/postfach" })}
          className="mt-3 w-full rounded-2xl border border-primary/40 bg-primary/10 px-3 py-2.5 text-left text-xs font-semibold text-primary"
        >
          {postfach.actionableCount} offene Einladung{postfach.actionableCount === 1 ? "" : "en"} im
          Postfach
        </button>
      )}

      <div className="mt-4 space-y-2">
        {tab === "code" && <FriendCodeCard onSent={() => void load()} />}

        {tab !== "code" && loading && <p className="text-xs text-muted-foreground">Lade…</p>}

        {!loading &&
          tab === "friends" &&
          (friends.length === 0 ? (
            <Empty text="Noch keine Freunde. Tausche im Tab Code deinen Freundescode mit einem Freund." />
          ) : (
            friends.map((friend) => (
              <FriendRow
                key={friend.id}
                friend={friend}
                actions={
                  <div className="flex flex-wrap justify-end gap-1.5">
                    <RowButton
                      label={`Nachricht an ${friend.displayName}`}
                      disabled={busy === friend.friendshipId}
                      onClick={() => void message(friend)}
                    >
                      Nachricht
                    </RowButton>
                    <RowButton
                      label={`Battle mit ${friend.displayName}`}
                      onClick={() => void navigate({ to: "/battle" })}
                    >
                      Battle
                    </RowButton>
                    {calls.supported && (
                      <>
                        <RowButton
                          label={`${friend.displayName} anrufen`}
                          disabled={calls.inCall}
                          onClick={() =>
                            void calls.startCall(
                              {
                                id: friend.id,
                                name: friend.displayName,
                                avatarUrl: friend.avatarUrl,
                              },
                              "audio",
                            )
                          }
                        >
                          Anruf
                        </RowButton>
                        <RowButton
                          label={`Videoanruf mit ${friend.displayName}`}
                          disabled={calls.inCall}
                          onClick={() =>
                            void calls.startCall(
                              {
                                id: friend.id,
                                name: friend.displayName,
                                avatarUrl: friend.avatarUrl,
                              },
                              "video",
                            )
                          }
                        >
                          Video
                        </RowButton>
                      </>
                    )}
                    {confirmRemove === friend.friendshipId ? (
                      <RowButton
                        label="Freund wirklich entfernen"
                        danger
                        disabled={busy === friend.friendshipId}
                        onClick={() => void remove(friend)}
                      >
                        Sicher?
                      </RowButton>
                    ) : (
                      <RowButton
                        label={`${friend.displayName} entfernen`}
                        danger
                        onClick={() => setConfirmRemove(friend.friendshipId)}
                      >
                        Entfernen
                      </RowButton>
                    )}
                  </div>
                }
              />
            ))
          ))}

        {!loading &&
          tab === "sent" &&
          (sentError ? (
            <Empty text={sentError} />
          ) : sent.length === 0 ? (
            <Empty text="Keine offenen Einladungen. Dein Freund muss eine Einladung im Postfach annehmen." />
          ) : (
            sent.map((request) => (
              <FriendRow
                key={request.friendshipId}
                friend={{
                  id: request.toUserId,
                  friendshipId: request.friendshipId,
                  displayName: request.toName,
                  avatarUrl: request.toAvatarUrl,
                  level: 0,
                  xp: 0,
                  streak: 0,
                  battleWins: 0,
                }}
                hideStats
                actions={
                  <RowButton
                    label={`Einladung an ${request.toName} zurückziehen`}
                    disabled={busy === request.friendshipId}
                    onClick={() => void withdraw(request)}
                  >
                    Zurückziehen
                  </RowButton>
                }
              />
            ))
          ))}
      </div>
    </div>
  );
}

function FriendRow({
  friend,
  actions,
  hideStats,
}: {
  friend: FriendEntry;
  actions: React.ReactNode;
  hideStats?: boolean;
}) {
  const initial = (friend.displayName || "?").slice(0, 1).toUpperCase();
  return (
    <div className="rounded-2xl border border-border bg-card/40 px-3 py-2.5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary text-sm font-semibold">
          {friend.avatarUrl ? (
            <img src={friend.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            initial
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{friend.displayName}</div>
          {!hideStats && (
            <div className="truncate text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Lv {friend.level} · {friend.xp} XP · Serie {friend.streak} · Siege {friend.battleWins}
            </div>
          )}
        </div>
      </div>
      <div className="mt-2">{actions}</div>
    </div>
  );
}

function RowButton({
  children,
  onClick,
  label,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`min-h-9 rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.2em] transition disabled:opacity-50 ${
        danger
          ? "border-border text-muted-foreground hover:border-destructive hover:text-destructive"
          : "border-primary/40 text-primary hover:bg-primary/10"
      }`}
    >
      {children}
    </button>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex-1 whitespace-nowrap rounded-full px-3 py-1.5 transition ${
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-2xl border border-border bg-card/40 p-4 text-center text-xs text-muted-foreground">
      {text}
    </p>
  );
}
