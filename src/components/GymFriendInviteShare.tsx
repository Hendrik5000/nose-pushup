import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { loadFriendEntries } from "@/lib/friends/supabase-friends";
import type { FriendEntry } from "@/lib/friends/friends-client";
import { BackendNotReadyError } from "@/lib/friends/rpc";
import { openCloudDm } from "@/lib/nexus-cloud";
import { buildGymInviteMessage } from "@/lib/gym-partner";

const button =
  "min-h-11 rounded-xl border border-border px-3 py-2 text-sm font-medium disabled:opacity-50";

/** Share a temporary Gym invite with an accepted Alo friend; the user always sends the DM manually. */
export function GymFriendInviteShare({
  userId,
  inviteCode,
  inviteExpiresAt,
}: {
  userId: string;
  inviteCode: string;
  inviteExpiresAt: string | null;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [friends, setFriends] = useState<FriendEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyFriend, setBusyFriend] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const toggle = async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    setError("");
    setNotice("");
    if (friends !== null) return;
    setLoading(true);
    try {
      setFriends(await loadFriendEntries(userId));
    } catch {
      setFriends([]);
      setError("Deine bestätigten Alo-Freunde konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  };

  const shareWith = async (friend: FriendEntry) => {
    if (busyFriend) return;
    setBusyFriend(friend.id);
    setError("");
    setNotice("");
    try {
      const message = buildGymInviteMessage(inviteCode, inviteExpiresAt);
      if (!navigator.clipboard?.writeText) {
        throw new Error("Die Zwischenablage ist in diesem Browser nicht verfügbar.");
      }
      await navigator.clipboard.writeText(message);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Der Einladungstext konnte nicht kopiert werden.",
      );
      setBusyFriend(null);
      return;
    }

    try {
      const conversationId = await openCloudDm(friend.id);
      await navigate({ to: "/chat", search: { dm: conversationId } });
      setNotice("Einladungstext kopiert. Füge ihn im Chat ein und sende ihn selbst.");
    } catch (cause) {
      setNotice(
        "Einladungstext kopiert. Der Chat konnte nicht geöffnet werden – du kannst den Code trotzdem manuell teilen.",
      );
      if (cause instanceof BackendNotReadyError) {
        setError("Der Nexus-Freunde-Chat ist auf dem Server noch nicht eingerichtet.");
      }
    } finally {
      setBusyFriend(null);
    }
  };

  return (
    <div className="mt-3 space-y-2">
      <button type="button" className={button} aria-expanded={open} onClick={() => void toggle()}>
        {open ? "Freundesauswahl schließen" : "Mit Alo-Freund teilen"}
      </button>
      {open && (
        <div className="space-y-2 rounded-xl border border-border bg-background/70 p-3">
          <p className="text-xs text-muted-foreground">
            Wähle einen bestätigten Freund. Der Einladungstext wird kopiert und sein Nexus-Chat
            geöffnet – gesendet wird erst, wenn du ihn selbst einfügst und abschickst.
          </p>
          {loading && (
            <p role="status" className="text-sm text-muted-foreground">
              Freunde werden geladen …
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="text-sm text-primary">
              {notice}
            </p>
          )}
          {friends && friends.length === 0 && !loading && (
            <p className="text-sm text-muted-foreground">Keine bestätigten Alo-Freunde gefunden.</p>
          )}
          {friends && friends.length > 0 && (
            <ul className="space-y-1">
              {friends.map((friend) => (
                <li key={friend.id}>
                  <button
                    type="button"
                    className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg px-2 text-left text-sm hover:bg-secondary/70 disabled:opacity-50"
                    disabled={busyFriend !== null}
                    onClick={() => void shareWith(friend)}
                  >
                    <span className="min-w-0 truncate font-medium">{friend.displayName}</span>
                    <span className="shrink-0 text-xs text-primary">
                      {busyFriend === friend.id ? "Öffne Chat …" : "Code kopieren & Chat öffnen"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
