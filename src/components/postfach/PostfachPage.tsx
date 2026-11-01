import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { FriendCodeCard } from "@/components/friends/FriendCodeCard";
import { useCalls } from "@/components/calls/CallProvider";
import { usePostfach } from "./PostfachProvider";
import {
  describePostfachItem,
  describeResolution,
  isActionable,
  isExpired,
  type PostfachItem,
} from "@/lib/friends/postfach";
import { openCloudDm } from "@/lib/nexus-cloud";

function formatWhen(iso: string): string {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return "";
  return new Date(time).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PostfachPage() {
  const postfach = usePostfach();
  const calls = useCalls();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);

  const open = useMemo(() => postfach.items.filter((item) => isActionable(item)), [postfach.items]);
  const rest = useMemo(
    () => postfach.items.filter((item) => !isActionable(item)),
    [postfach.items],
  );

  // Information items count as read once the Postfach was opened. Open invitations stay unread.
  const unreadInfoIds = rest
    .filter(
      (item) => !item.readAt && item.kind !== "friend_request" && item.kind !== "battle_invitation",
    )
    .map((item) => item.id);
  const unreadKey = unreadInfoIds.join(",");
  useEffect(() => {
    if (!unreadKey) return;
    const timer = window.setTimeout(() => void postfach.markRead(unreadKey.split(",")), 1500);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadKey]);

  const run = async (item: PostfachItem, action: () => Promise<string>) => {
    if (busy) return;
    setBusy(item.id);
    try {
      const message = await action();
      if (message) toast(message);
    } finally {
      setBusy(null);
    }
  };

  const chat = async (item: PostfachItem) => {
    if (!item.fromUserId) return;
    try {
      const id = await openCloudDm(item.fromUserId);
      await navigate({ to: "/chat", search: { dm: id } });
    } catch {
      toast("Die Direktnachricht konnte nicht geöffnet werden.");
    }
  };

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-28 pt-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Postfach</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Freundschaftseinladungen, Battle-Anfragen und verpasste Anrufe.
          </p>
        </div>
        <Link
          to="/profile"
          className="shrink-0 rounded-full border border-border px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
        >
          Freunde
        </Link>
      </header>

      {!postfach.available && !postfach.loading && (
        <p
          role="status"
          className="mt-6 rounded-2xl border border-border bg-card/40 p-4 text-sm text-muted-foreground"
        >
          Das Postfach ist für dieses Konto noch nicht verfügbar. Es braucht ein registriertes Konto
          und die Server-Einrichtung der Freunde-Funktion.
        </p>
      )}

      <section aria-labelledby="postfach-open" className="mt-6">
        <h2
          id="postfach-open"
          className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground"
        >
          Offen {open.length > 0 && `(${open.length})`}
        </h2>
        <div className="mt-3 space-y-2">
          {postfach.loading && <p className="text-xs text-muted-foreground">Lade…</p>}
          {!postfach.loading && open.length === 0 && (
            <p className="rounded-2xl border border-border bg-card/40 p-4 text-center text-xs text-muted-foreground">
              Keine offenen Einladungen.
            </p>
          )}
          {open.map((item) => (
            <ItemCard key={item.id} item={item}>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() =>
                    void run(item, () =>
                      item.kind === "friend_request"
                        ? postfach.respondFriend(item, true)
                        : postfach.respondBattle(item, true),
                    )
                  }
                  className="min-h-11 rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                >
                  Annehmen
                </button>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() =>
                    void run(item, () =>
                      item.kind === "friend_request"
                        ? postfach.respondFriend(item, false)
                        : postfach.respondBattle(item, false),
                    )
                  }
                  className="min-h-11 rounded-xl border border-border px-3 text-xs font-semibold disabled:opacity-50"
                >
                  Ablehnen
                </button>
              </div>
            </ItemCard>
          ))}
        </div>
      </section>

      <section aria-labelledby="postfach-history" className="mt-8">
        <div className="flex items-center justify-between gap-2">
          <h2
            id="postfach-history"
            className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground"
          >
            Verlauf
          </h2>
          {rest.length > 0 && (
            <button
              type="button"
              onClick={() => void postfach.remove(rest.map((item) => item.id))}
              className="rounded-full border border-border px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-destructive"
            >
              Verlauf leeren
            </button>
          )}
        </div>
        <div className="mt-3 space-y-2">
          {!postfach.loading && rest.length === 0 && (
            <p className="rounded-2xl border border-border bg-card/40 p-4 text-center text-xs text-muted-foreground">
              Noch nichts im Verlauf.
            </p>
          )}
          {rest.map((item) => (
            <ItemCard key={item.id} item={item}>
              <div className="mt-2 flex flex-wrap gap-2">
                {item.kind === "battle_accepted" && !item.resolvedAt && item.battleId && (
                  <SmallButton
                    disabled={busy !== null}
                    onClick={() => void run(item, () => postfach.openBattle(item))}
                  >
                    Warteraum öffnen
                  </SmallButton>
                )}
                {item.kind === "missed_call" && item.fromUserId && calls.supported && (
                  <SmallButton
                    disabled={calls.inCall}
                    onClick={() =>
                      void calls.startCall(
                        {
                          id: item.fromUserId!,
                          name: item.fromName,
                          avatarUrl: item.fromAvatarUrl,
                        },
                        item.callKind ?? "audio",
                      )
                    }
                  >
                    Zurückrufen
                  </SmallButton>
                )}
                {(item.kind === "friend_accepted" || item.kind === "missed_call") &&
                  item.fromUserId && (
                    <SmallButton onClick={() => void chat(item)}>Nachricht schreiben</SmallButton>
                  )}
                <SmallButton danger onClick={() => void postfach.remove([item.id])}>
                  Löschen
                </SmallButton>
              </div>
            </ItemCard>
          ))}
        </div>
      </section>

      <section aria-labelledby="postfach-add" className="mt-8">
        <h2
          id="postfach-add"
          className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground"
        >
          Freunde hinzufügen
        </h2>
        <div className="mt-3">
          <FriendCodeCard />
        </div>
      </section>
    </main>
  );
}

function ItemCard({ item, children }: { item: PostfachItem; children?: React.ReactNode }) {
  const { title, body } = describePostfachItem(item);
  const resolution = describeResolution(item);
  const expired = item.kind === "battle_invitation" && isExpired(item) && !item.resolvedAt;
  const unread = !item.readAt && !item.resolvedAt;
  return (
    <article className="rounded-2xl border border-border bg-card/40 p-3.5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary text-sm font-semibold">
          {item.fromAvatarUrl ? (
            <img src={item.fromAvatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            item.fromName.slice(0, 1).toUpperCase()
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">{title}</h3>
            {unread && (
              <span className="h-2 w-2 rounded-full bg-primary" role="img" aria-label="Neu" />
            )}
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">{body}</p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {formatWhen(item.createdAt)}
            {(resolution || expired) && ` · ${expired ? "Abgelaufen" : resolution}`}
          </p>
        </div>
      </div>
      {children}
    </article>
  );
}

function SmallButton({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-h-9 rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.2em] disabled:opacity-50 ${
        danger
          ? "border-border text-muted-foreground hover:text-destructive"
          : "border-primary/40 text-primary hover:bg-primary/10"
      }`}
    >
      {children}
    </button>
  );
}
