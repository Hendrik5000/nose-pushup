import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  createRoom,
  deleteMessage,
  editMessage,
  getOrCreateDm,
  loadChatStore,
  messagesFor,
  sendMessage,
  toggleReaction,
  type LocalDm,
  type LocalMessage,
  type LocalReaction,
  type LocalRoom,
} from "@/lib/local-chat";
import { QUICK_EMOJIS, formatTime, initials } from "@/components/chat/types";

type Target = { kind: "room" | "dm"; id: string };

export function LocalChatShell() {
  const [userId, setUserId] = useState<string | null>(null);
  const [myName, setMyName] = useState("Du");
  const [rooms, setRooms] = useState<LocalRoom[]>([]);
  const [dms, setDms] = useState<LocalDm[]>([]);
  const [active, setActive] = useState<Target | null>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [reactions, setReactions] = useState<LocalReaction[]>([]);
  const [replyTo, setReplyTo] = useState<LocalMessage | null>(null);
  const [draft, setDraft] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [newRoomOpen, setNewRoomOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [dmName, setDmName] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(
    (uid: string, target: Target | null) => {
      const store = loadChatStore(uid);
      setRooms(store.rooms);
      setDms(store.dms);
      setReactions(store.reactions);
      if (target) setMessages(messagesFor(store, target));
      else if (store.rooms[0]) {
        const t: Target = { kind: "room", id: store.rooms[0].id };
        setActive(t);
        setMessages(messagesFor(store, t));
      }
    },
    [],
  );

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const u = data.user;
      if (!u) return;
      setUserId(u.id);
      const { data: p } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", u.id)
        .maybeSingle();
      setMyName(
        (p?.display_name as string | null) ||
          (u.user_metadata?.display_name as string | undefined) ||
          (u.is_anonymous ? "Gast" : u.email?.split("@")[0]) ||
          "Du",
      );
      refresh(u.id, null);
    })();
  }, [refresh]);

  useEffect(() => {
    if (!userId || !active) return;
    refresh(userId, active);
    setReplyTo(null);
  }, [userId, active, refresh]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, active?.id]);

  const headerTitle = useMemo(() => {
    if (!active) return "Chat";
    if (active.kind === "room")
      return rooms.find((r) => r.id === active.id)?.name ?? "Raum";
    return dms.find((d) => d.id === active.id)?.other_name ?? "DM";
  }, [active, rooms, dms]);

  const onSend = () => {
    if (!userId || !active) return;
    const content = draft.trim();
    if (!content) return;
    setDraft("");
    sendMessage(userId, {
      roomId: active.kind === "room" ? active.id : null,
      conversationId: active.kind === "dm" ? active.id : null,
      content,
      replyToId: replyTo?.id ?? null,
    });
    setReplyTo(null);
    refresh(userId, active);
  };

  const onCreateRoom = () => {
    if (!userId || !newRoomName.trim()) return;
    const room = createRoom(userId, newRoomName);
    setNewRoomName("");
    setNewRoomOpen(false);
    setActive({ kind: "room", id: room.id });
    refresh(userId, { kind: "room", id: room.id });
  };

  const onStartDm = () => {
    if (!userId || !dmName.trim()) return;
    const otherId = `local-${dmName.trim().toLowerCase().replace(/\s+/g, "-")}`;
    const dm = getOrCreateDm(userId, otherId, dmName.trim());
    setDmName("");
    setActive({ kind: "dm", id: dm.id });
    refresh(userId, { kind: "dm", id: dm.id });
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-4">
        <span className="text-xl">💬</span>
        <div>
          <div className="text-sm font-semibold">Nexus Chat</div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Lokal · dieses Gerät
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        <div className="mb-1 flex items-center justify-between px-1">
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Räume
          </span>
          <button
            type="button"
            onClick={() => setNewRoomOpen(true)}
            className="rounded-full px-2 py-0.5 text-xs text-primary"
          >
            +
          </button>
        </div>
        <div className="space-y-1 pb-4">
          {rooms.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                setActive({ kind: "room", id: r.id });
                setMenuOpen(false);
              }}
              className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                active?.kind === "room" && active.id === r.id
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-secondary/60"
              }`}
            >
              <span className="opacity-70">#</span>
              <span className="truncate font-medium">{r.name}</span>
            </button>
          ))}
        </div>

        <div className="mb-1 px-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Direktnachrichten
        </div>
        <div className="mb-2 flex gap-1">
          <input
            value={dmName}
            onChange={(e) => setDmName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onStartDm()}
            placeholder="Name…"
            className="min-w-0 flex-1 rounded-xl border border-border bg-background/60 px-2 py-1.5 text-xs outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={onStartDm}
            className="rounded-xl bg-primary px-2 py-1.5 text-xs font-semibold text-primary-foreground"
          >
            DM
          </button>
        </div>
        <div className="space-y-1">
          {dms.length === 0 && (
            <p className="px-2 py-2 text-xs text-muted-foreground">
              Noch keine DMs. Namen eingeben und starten.
            </p>
          )}
          {dms.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => {
                setActive({ kind: "dm", id: d.id });
                setMenuOpen(false);
              }}
              className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                active?.kind === "dm" && active.id === d.id
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-secondary/60"
              }`}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold">
                {initials(d.other_name)}
              </span>
              <span className="truncate font-medium">{d.other_name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
            {initials(myName)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{myName}</div>
            <div className="text-[10px] text-muted-foreground">Nur lokal gespeichert</div>
          </div>
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">
            App
          </Link>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background">
      <aside className="hidden w-72 shrink-0 border-r border-border md:block">{sidebar}</aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-border px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <button
            type="button"
            className="rounded-xl border border-border px-2 py-1.5 text-sm md:hidden"
            onClick={() => setMenuOpen(true)}
          >
            ☰
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{headerTitle}</div>
            <div className="text-[10px] text-muted-foreground">
              {active?.kind === "room" ? "Raum" : "Direktnachricht"} · lokal
            </div>
          </div>
          <Link
            to="/"
            className="rounded-full border border-border px-3 py-1 text-[10px] uppercase tracking-[0.15em] text-muted-foreground"
          >
            Dashboard
          </Link>
        </header>

        {menuOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-black/50"
              onClick={() => setMenuOpen(false)}
              aria-label="Schließen"
            />
            <div className="absolute inset-y-0 left-0 w-[85vw] max-w-80 border-r border-border bg-background shadow-xl">
              {sidebar}
            </div>
          </div>
        )}

        {newRoomOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-4">
              <div className="text-sm font-semibold">Neuer Raum</div>
              <input
                autoFocus
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onCreateRoom()}
                placeholder="Name"
                className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
              />
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setNewRoomOpen(false)}
                  className="flex-1 rounded-xl border border-border py-2 text-sm"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={onCreateRoom}
                  className="flex-1 rounded-xl bg-primary py-2 text-sm font-semibold text-primary-foreground"
                >
                  Erstellen
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
          {messages.map((m, i) => {
            const own = m.user_id === userId;
            const prev = messages[i - 1];
            const showAuthor = !prev || prev.user_id !== m.user_id;
            const author =
              m.user_id === "system"
                ? "System"
                : own
                  ? myName
                  : dms.find((d) => d.other_id === m.user_id)?.other_name || "Mitglied";
            const reply = m.reply_to_id
              ? messages.find((x) => x.id === m.reply_to_id)
              : null;
            const msgReactions = reactions.filter((r) => r.message_id === m.id);
            const grouped = msgReactions.reduce<
              Record<string, { count: number; mine: boolean }>
            >((acc, r) => {
              const e = acc[r.emoji] ?? { count: 0, mine: false };
              e.count += 1;
              if (r.user_id === userId) e.mine = true;
              acc[r.emoji] = e;
              return acc;
            }, {});

            return (
              <div
                key={m.id}
                id={`msg-${m.id}`}
                className={`flex flex-col gap-1 ${own ? "items-end" : "items-start"}`}
              >
                {showAuthor && (
                  <div className="flex items-center gap-2 px-1 text-[10px] text-muted-foreground">
                    <span className="font-medium">{own ? "Du" : author}</span>
                    <span>{formatTime(m.created_at)}</span>
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${
                    own
                      ? "rounded-br-sm bg-primary text-primary-foreground"
                      : m.user_id === "system"
                        ? "rounded-bl-sm border border-border bg-card/60 text-muted-foreground"
                        : "rounded-bl-sm bg-secondary text-secondary-foreground"
                  }`}
                >
                  {reply && (
                    <div className="mb-1.5 rounded-lg border-l-2 border-primary/60 bg-background/20 px-2 py-1 text-xs opacity-80">
                      <div className="font-medium">Antwort</div>
                      <div className="truncate">{reply.content}</div>
                    </div>
                  )}
                  <div className="whitespace-pre-wrap break-words">{m.content}</div>
                  {m.edited_at && (
                    <div className="mt-0.5 text-[10px] opacity-60">(bearbeitet)</div>
                  )}
                </div>

                {Object.keys(grouped).length > 0 && (
                  <div className={`flex flex-wrap gap-1 px-1 ${own ? "justify-end" : ""}`}>
                    {Object.entries(grouped).map(([emoji, info]) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          if (!userId) return;
                          toggleReaction(userId, m.id, emoji);
                          refresh(userId, active);
                        }}
                        className={`rounded-full border px-2 py-0.5 text-xs ${
                          info.mine
                            ? "border-primary bg-primary/15"
                            : "border-border bg-card/50"
                        }`}
                      >
                        {emoji} {info.count}
                      </button>
                    ))}
                  </div>
                )}

                <div className={`flex gap-1 px-1 ${own ? "justify-end" : ""}`}>
                  {QUICK_EMOJIS.slice(0, 4).map((e) => (
                    <button
                      key={e}
                      type="button"
                      className="text-xs opacity-40 transition hover:opacity-100"
                      onClick={() => {
                        if (!userId) return;
                        toggleReaction(userId, m.id, e);
                        refresh(userId, active);
                      }}
                    >
                      {e}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="text-[10px] text-muted-foreground"
                    onClick={() => setReplyTo(m)}
                  >
                    Antwort
                  </button>
                  {own && m.user_id !== "system" && (
                    <>
                      <button
                        type="button"
                        className="text-[10px] text-muted-foreground"
                        onClick={() => {
                          const next = window.prompt("Bearbeiten", m.content);
                          if (next && userId) {
                            editMessage(userId, m.id, next);
                            refresh(userId, active);
                          }
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-[10px] text-destructive"
                        onClick={() => {
                          if (!userId) return;
                          deleteMessage(userId, m.id);
                          refresh(userId, active);
                        }}
                      >
                        Löschen
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-border px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          {replyTo && (
            <div className="mb-2 flex items-center gap-2 rounded-xl border-l-2 border-primary bg-secondary/40 px-3 py-2 text-xs">
              <div className="min-w-0 flex-1 truncate">
                Antwort: {replyTo.content}
              </div>
              <button type="button" onClick={() => setReplyTo(null)} className="text-muted-foreground">
                ✕
              </button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onSend();
                }
              }}
              rows={1}
              placeholder={active ? "Nachricht…" : "Raum wählen…"}
              disabled={!active}
              className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-border bg-card/50 px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={onSend}
              disabled={!active || !draft.trim()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground disabled:opacity-40"
            >
              ↑
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
