import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ImagePlus, Phone, Video, X } from "lucide-react";
import { useCalls } from "@/components/calls/CallProvider";
import { loadFriendEntries } from "@/lib/friends/supabase-friends";
import type { FriendEntry } from "@/lib/friends/friends-client";
import { openCloudDm } from "@/lib/nexus-cloud";
import { CHAT_IMAGE_TYPES } from "@/lib/nexus-images";

/** Friends-only list to start a cloud direct message. Strangers cannot be messaged. */
export function FriendDmPicker({
  userId,
  onOpen,
}: {
  userId: string;
  onOpen: (conversationId: string) => void;
}) {
  const [friends, setFriends] = useState<FriendEntry[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadFriendEntries(userId)
      .then((list) => active && setFriends(list))
      .catch(() => active && setFriends([]));
    return () => {
      active = false;
    };
  }, [userId]);

  const open = async (friend: FriendEntry) => {
    setBusy(friend.id);
    setError(null);
    try {
      onOpen(await openCloudDm(friend.id));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Die Direktnachricht konnte nicht geöffnet werden.",
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mb-2 rounded-xl border border-border bg-background/40 p-2">
      <p className="px-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        Mit Freund schreiben
      </p>
      {friends === null && (
        <p className="px-1 py-2 text-xs text-muted-foreground">Freunde werden geladen…</p>
      )}
      {friends !== null && friends.length === 0 && (
        <p className="px-1 py-2 text-xs text-muted-foreground">
          Direktnachrichten gibt es nur mit Freunden.{" "}
          <Link to="/profile" hash="profile-training" className="underline underline-offset-2">
            Freund per Code hinzufügen
          </Link>
        </p>
      )}
      <ul className="mt-1 space-y-1">
        {friends?.map((friend) => (
          <li key={friend.id}>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void open(friend)}
              aria-label={`Direktnachricht an ${friend.displayName}`}
              className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-left text-sm hover:bg-secondary/60 disabled:opacity-50"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary text-xs font-semibold">
                {friend.avatarUrl ? (
                  <img src={friend.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  friend.displayName.slice(0, 1).toUpperCase()
                )}
              </span>
              <span className="truncate">{friend.displayName}</span>
            </button>
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="px-1 pt-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/** Image attach button. In local mode it stays visible but disabled, with an explanation. */
export function AttachImageButton({
  enabled,
  busy,
  onPick,
  size = "md",
}: {
  enabled: boolean;
  busy: boolean;
  onPick: (file: File) => void;
  size?: "md" | "lg";
}) {
  const input = useRef<HTMLInputElement>(null);
  const dimension = size === "lg" ? "h-12 w-12 rounded-2xl" : "h-10 w-10 rounded-xl";
  return (
    <>
      <input
        ref={input}
        type="file"
        accept={CHAT_IMAGE_TYPES.join(",")}
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) onPick(file);
        }}
      />
      <button
        type="button"
        disabled={!enabled || busy}
        onClick={() => input.current?.click()}
        aria-label="Bild senden"
        title={
          enabled
            ? "Bild senden (JPEG, PNG, WebP oder GIF, bis 5 MB)"
            : "Bilder gibt es nur im verbundenen Chat mit Freunden und in Räumen."
        }
        className={`flex shrink-0 items-center justify-center border border-border bg-secondary/40 disabled:opacity-40 ${dimension}`}
      >
        <ImagePlus className="h-5 w-5" aria-hidden="true" />
      </button>
    </>
  );
}

/** Audio and video call buttons for a friend DM. */
export function CallButtons({
  peer,
  conversationId,
  compact,
}: {
  peer: { id: string; name: string } | null;
  conversationId: string;
  compact?: boolean;
}) {
  const calls = useCalls();
  if (!peer) return null;
  if (!calls.supported) return null;
  const size = compact ? "h-8 w-8 rounded-xl" : "h-10 w-10 rounded-xl";
  return (
    <>
      <button
        type="button"
        disabled={calls.inCall}
        aria-label={`${peer.name} anrufen`}
        title="Sprachanruf"
        onClick={() =>
          void calls.startCall(
            { id: peer.id, name: peer.name, avatarUrl: null },
            "audio",
            conversationId,
          )
        }
        className={`flex items-center justify-center border border-border disabled:opacity-40 ${size}`}
      >
        <Phone className="h-4 w-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        disabled={calls.inCall}
        aria-label={`Videoanruf mit ${peer.name}`}
        title="Videoanruf"
        onClick={() =>
          void calls.startCall(
            { id: peer.id, name: peer.name, avatarUrl: null },
            "video",
            conversationId,
          )
        }
        className={`flex items-center justify-center border border-border disabled:opacity-40 ${size}`}
      >
        <Video className="h-4 w-4" aria-hidden="true" />
      </button>
    </>
  );
}

export function MessageImage({
  url,
  name,
  onOpen,
}: {
  url: string | undefined;
  name: string | null | undefined;
  onOpen: (url: string, name: string) => void;
}) {
  const label = name?.trim() || "Bild";
  if (!url) {
    return (
      <div className="mb-1 flex h-24 w-40 items-center justify-center rounded-xl bg-background/30 text-xs opacity-70">
        Bild wird geladen…
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onOpen(url, label)}
      aria-label={`${label} vergrößern`}
      className="mb-1 block overflow-hidden rounded-xl"
    >
      <img src={url} alt={label} loading="lazy" className="max-h-64 max-w-full object-contain" />
    </button>
  );
}

export function ImageLightbox({
  image,
  onClose,
}: {
  image: { url: string; name: string } | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!image) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [image, onClose]);
  if (!image) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={image.name}
      data-no-module-swipe
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Bild schließen"
        className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white"
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </button>
      <img
        src={image.url}
        alt={image.name}
        className="max-h-full max-w-full object-contain"
        onClick={(event) => event.stopPropagation()}
      />
    </div>
  );
}
