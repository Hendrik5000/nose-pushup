import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  ArrowLeft,
  MessageCircle,
  MoreVertical,
  Search,
  Users,
  Mic,
  MessageCirclePlus,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  createChatRoom,
  deleteChatMessage,
  detectChatMode,
  editChatMessage,
  loadMessages,
  loadRoomsForUser,
  postMessage,
  reactToMessage,
  type ChatMode,
  type LocalDm,
  type LocalMessage,
  type LocalReaction,
  type LocalRoom,
  getOrCreateLocalDm,
  loadChatStore,
} from "@/lib/chat-backend";
import { QUICK_EMOJIS, formatTime, initials } from "@/components/chat/types";
import {
  countUnread,
  exportMessagesMarkdown,
  getDraft,
  loadChatPrefs,
  markRead,
  QUICK_REPLIES,
  saveDraft,
  searchMessages,
  toggleFavoriteRoom,
  toggleMute,
  togglePinMessage,
  workoutShareTemplate,
  type ChatPrefs,
} from "@/lib/chat-extras";

type Target = { kind: "room" | "dm"; id: string };

export function LocalChatShell() {
  const [userId, setUserId] = useState<string | null>(null);
  const [myName, setMyName] = useState("Du");
  const [mode, setMode] = useState<ChatMode>("local");
  const [rooms, setRooms] = useState<LocalRoom[]>([]);
  const [dms, setDms] = useState<LocalDm[]>([]);
  const [active, setActive] = useState<Target | null>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [reactions, setReactions] = useState<LocalReaction[]>([]);
  const [replyTo, setReplyTo] = useState<LocalMessage | null>(null);
  const [draft, setDraft] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileListOpen, setMobileListOpen] = useState(true);
  const [roomQuery, setRoomQuery] = useState("");
  const [roomFilter, setRoomFilter] = useState<"all" | "favorites" | "dms">("all");
  const [newRoomOpen, setNewRoomOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [dmName, setDmName] = useState("");
  const [prefs, setPrefs] = useState<ChatPrefs | null>(null);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [todayReps, setTodayReps] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<Target | null>(null);
  activeRef.current = active;
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  const flash = (t: string) => {
    setToast(t);
    window.setTimeout(() => setToast(null), 2200);
  };

  const refresh = useCallback(
    async (uid: string, target: Target | null) => {
      const roomList = await loadRoomsForUser(uid);
      setRooms(roomList);
      setPrefs(loadChatPrefs(uid));

      if (mode === "local" || (await detectChatMode()) === "local") {
        const store = loadChatStore(uid);
        setDms(store.dms);
      }

      const t = target ?? (roomList[0] ? ({ kind: "room", id: roomList[0].id } as Target) : null);
      if (!target && t) setActive(t);
      if (!t) {
        setMessages([]);
        setReactions([]);
        return;
      }
      const { messages: msgs, reactions: reacts } = await loadMessages(uid, t);
      setMessages(msgs);
      setReactions(reacts);
      setPrefs(markRead(uid, t.kind, t.id, msgs[msgs.length - 1]?.created_at));
    },
    [mode],
  );

  useEffect(() => {
    (async () => {
      const m = await detectChatMode();
      setMode(m);
      const { data } = await supabase.auth.getUser();
      const u = data.user;
      if (!u) return;
      setUserId(u.id);
      const today = new Date().toISOString().slice(0, 10);
      const [{ data: p }, { data: ds }] = await Promise.all([
        supabase.from("profiles").select("display_name").eq("id", u.id).maybeSingle(),
        supabase
          .from("daily_stats")
          .select("total_reps")
          .eq("user_id", u.id)
          .eq("day", today)
          .maybeSingle(),
      ]);
      setMyName(
        (p?.display_name as string | null) ||
          (u.user_metadata?.display_name as string | undefined) ||
          (u.is_anonymous ? "Gast" : u.email?.split("@")[0]) ||
          "Du",
      );
      setTodayReps(ds?.total_reps ?? 0);
      setPrefs(loadChatPrefs(u.id));
      await refresh(u.id, null);
    })();
  }, [refresh]);

  useEffect(() => {
    if (!userId || !active) return;
    void refresh(userId, active);
    setReplyTo(null);
    setDraft(getDraft(userId, active.kind, active.id));
    setSearch("");
    setSearchOpen(false);
  }, [userId, active?.kind, active?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, active?.id]);

  useEffect(() => {
    if (mode !== "supabase" || !userId) return;
    const channel = supabase
      .channel("nose-chat-stream")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => {
        const t = activeRef.current;
        if (t) void refresh(userId, t);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, () => {
        const t = activeRef.current;
        if (t) void refresh(userId, t);
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [mode, userId, refresh]);

  const headerTitle = useMemo(() => {
    if (!active) return "Chat";
    if (active.kind === "room") return rooms.find((r) => r.id === active.id)?.name ?? "Raum";
    return dms.find((d) => d.id === active.id)?.other_name ?? "DM";
  }, [active, rooms, dms]);

  const sortedRooms = useMemo(() => {
    if (!prefs) return rooms;
    const fav = prefs.favoriteRoomIds;
    return [...rooms].sort((a, b) => {
      const af = fav.includes(a.id) ? 0 : 1;
      const bf = fav.includes(b.id) ? 0 : 1;
      if (af !== bf) return af - bf;
      return a.name.localeCompare(b.name);
    });
  }, [rooms, prefs]);

  const pinned = useMemo(() => {
    if (!prefs) return [];
    return messages.filter((m) => prefs.pinnedMessageIds.includes(m.id));
  }, [messages, prefs]);

  const hits = useMemo(() => searchMessages(messages, search), [messages, search]);

  const onSend = async (text?: string) => {
    if (!userId || !active) return;
    const content = (text ?? draft).trim();
    if (!content) return;
    setDraft("");
    saveDraft(userId, active.kind, active.id, "");
    await postMessage(userId, {
      roomId: active.kind === "room" ? active.id : null,
      conversationId: active.kind === "dm" ? active.id : null,
      content,
      replyToId: replyTo?.id ?? null,
    });
    setReplyTo(null);
    await refresh(userId, active);
  };

  const onCreateRoom = async () => {
    if (!userId || !newRoomName.trim()) return;
    const room = await createChatRoom(userId, newRoomName);
    setNewRoomName("");
    setNewRoomOpen(false);
    if (room) {
      setActive({ kind: "room", id: room.id });
      setMobileListOpen(false);
      await refresh(userId, { kind: "room", id: room.id });
    }
  };

  const onStartDm = async () => {
    if (!userId || !dmName.trim()) return;
    const otherId = `local-${dmName.trim().toLowerCase().replace(/\s+/g, "-")}`;
    const dm = getOrCreateLocalDm(userId, otherId, dmName.trim());
    setDmName("");
    setActive({ kind: "dm", id: dm.id });
    setMobileListOpen(false);
    await refresh(userId, { kind: "dm", id: dm.id });
  };

  const toggleVoice = () => {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRec;
      webkitSpeechRecognition?: new () => SpeechRec;
    };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      flash("Spracheingabe nicht unterstützt");
      return;
    }
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }
    const rec = new SR();
    rec.lang = "de-DE";
    rec.interimResults = false;
    rec.onresult = (ev) => {
      const t = ev.results?.[0]?.[0]?.transcript ?? "";
      if (t) setDraft((d) => (d ? `${d} ${t}` : t));
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  };

  const exportActive = async () => {
    if (!active) return;
    const md = exportMessagesMarkdown(headerTitle, messages, (uid) =>
      uid === userId
        ? myName
        : uid === "system"
          ? "System"
          : dms.find((d) => d.other_id === uid)?.other_name || "Mitglied",
    );
    try {
      await navigator.clipboard.writeText(md);
      flash("Chat als Markdown kopiert");
    } catch {
      flash("Kopieren fehlgeschlagen");
    }
  };

  const modeLabel = mode === "supabase" ? "Cloud · Supabase" : "Lokal · Gerät";

  const visibleRooms = sortedRooms.filter(
    (room) =>
      roomFilter !== "dms" &&
      (roomFilter !== "favorites" || prefs?.favoriteRoomIds.includes(room.id)) &&
      room.name.toLocaleLowerCase("de-DE").includes(roomQuery.toLocaleLowerCase("de-DE")),
  );
  const visibleDms = dms.filter(
    (dm) =>
      roomFilter !== "favorites" &&
      dm.other_name.toLocaleLowerCase("de-DE").includes(roomQuery.toLocaleLowerCase("de-DE")),
  );

  const dmComposer = (
    <div className="community-dm-create mb-2 flex gap-1">
      <input
        value={dmName}
        onChange={(e) => setDmName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && void onStartDm()}
        placeholder="Name…"
        className="min-w-0 flex-1 rounded-xl border border-border bg-background/60 px-2 py-1.5 text-xs outline-none focus:border-primary"
      />
      <button
        type="button"
        onClick={() => void onStartDm()}
        className="rounded-xl bg-primary px-2 py-1.5 text-xs font-semibold text-primary-foreground"
      >
        DM
      </button>
    </div>
  );

  const sidebar = (
    <div className="sport-chat-sidebar flex h-full flex-col bg-card/40">
      <div className="community-list-heading border-b border-border bg-gradient-to-br from-primary/15 to-transparent px-4 py-4">
        <div className="flex items-center gap-2">
          <span className="classic-only flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/20 text-xl">
            💬
          </span>
          <div>
            <div className="text-sm font-bold">
              <span className="classic-only">Community-Chat</span>
              <span className="sport-only">Chats</span>
            </div>
            <div className="classic-only text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {modeLabel}
            </div>
          </div>
        </div>
      </div>

      <div className="sport-only community-list-controls">
        <label className="community-search">
          <Search aria-hidden="true" />
          <input
            value={roomQuery}
            onChange={(event) => setRoomQuery(event.target.value)}
            placeholder="Chats durchsuchen"
            aria-label="Community-Chats durchsuchen"
          />
        </label>
        <div className="community-filter-chips" role="group" aria-label="Community-Chats filtern">
          {(
            [
              ["all", "Alle"],
              ["favorites", "Favoriten"],
              ["dms", "Direkt"],
            ] as const
          ).map(([filter, label]) => (
            <button
              key={filter}
              type="button"
              aria-pressed={roomFilter === filter}
              onClick={() => setRoomFilter(filter)}
            >
              {label}
            </button>
          ))}
        </div>
        <p>
          {mode === "local"
            ? "Nur auf diesem Gerät gespeichert. Kein Versand an andere Geräte."
            : "Mit deiner Community verbunden."}
        </p>
      </div>
      <div className="community-list-scroll flex-1 overflow-y-auto px-3 py-3">
        <div className="mb-1 flex items-center justify-between px-1">
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Räume
          </span>
          <button
            type="button"
            onClick={() => setNewRoomOpen(true)}
            className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary"
          >
            +
          </button>
        </div>
        <div className="space-y-1 pb-4">
          {visibleRooms.map((r) => {
            const muted = prefs?.mutedRoomIds.includes(r.id);
            const fav = prefs?.favoriteRoomIds.includes(r.id);
            const storeMsgs =
              userId && mode === "local"
                ? loadChatStore(userId).messages.filter((m) => m.room_id === r.id)
                : [];
            const unread =
              userId && prefs ? countUnread(prefs, "room", r.id, storeMsgs, userId) : 0;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setActive({ kind: "room", id: r.id });
                  setMenuOpen(false);
                  setMobileListOpen(false);
                }}
                className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                  active?.kind === "room" && active.id === r.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "hover:bg-secondary/60"
                }`}
              >
                <span className="community-room-avatar">
                  <span className="classic-only">{fav ? "★" : "#"}</span>
                  <Users className="sport-only" aria-hidden="true" />
                </span>
                <span className="community-room-copy min-w-0 flex-1 truncate font-medium">
                  <strong className="truncate">
                    {r.name}
                    {muted ? " 🔇" : ""}
                  </strong>
                  <small className="sport-only">
                    {storeMsgs.at(-1)?.content ?? "Gruppenraum öffnen"}
                  </small>
                </span>
                {storeMsgs.at(-1) && (
                  <time className="sport-only community-room-time">
                    {formatTime(storeMsgs.at(-1)!.created_at)}
                  </time>
                )}
                {unread > 0 && active?.id !== r.id && (
                  <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mb-1 px-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Direktnachrichten
        </div>
        <div className="classic-only">{dmComposer}</div>
        <details className="sport-only community-dm-details">
          <summary>Direktnachricht starten</summary>
          {dmComposer}
        </details>
        <div className="space-y-1">
          {dms.length === 0 && (
            <p className="px-2 py-2 text-xs text-muted-foreground">Noch keine DMs.</p>
          )}
          {visibleDms.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => {
                setActive({ kind: "dm", id: d.id });
                setMenuOpen(false);
                setMobileListOpen(false);
              }}
              className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                active?.kind === "dm" && active.id === d.id
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-secondary/60"
              }`}
            >
              <span className="community-room-avatar flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold">
                {initials(d.other_name)}
              </span>
              <span className="community-room-copy truncate font-medium">
                <strong className="truncate">{d.other_name}</strong>
                <small className="sport-only">Direktnachricht öffnen</small>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="community-account border-t border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
            {initials(myName)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{myName}</div>
            <div className="text-[10px] text-muted-foreground">{modeLabel}</div>
          </div>
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">
            App
          </Link>
        </div>
      </div>
    </div>
  );

  return (
    <div
      className={`app-chat-shell sport-chat-app flex overflow-hidden bg-background ${mobileListOpen ? "community-show-list" : "community-show-conversation"}`}
    >
      <div className="sport-only community-mobile-list">
        {sidebar}
        <button
          type="button"
          className="community-new-chat"
          aria-label="Neuen Gruppenraum erstellen"
          onClick={() => setNewRoomOpen(true)}
        >
          <MessageCirclePlus aria-hidden="true" />
        </button>
      </div>
      <aside className="hidden w-72 shrink-0 border-r border-border md:block">{sidebar}</aside>

      <section className="community-conversation flex min-w-0 flex-1 flex-col">
        <header className="classic-only flex items-center gap-2 border-b border-border bg-card/50 px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
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
              {active?.kind === "room" ? "Raum" : "DM"} · {mode === "supabase" ? "Cloud" : "lokal"}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {active?.kind === "room" && userId && (
              <>
                <HeadBtn
                  label="Favorit"
                  onClick={() => setPrefs(toggleFavoriteRoom(userId, active.id))}
                >
                  {prefs?.favoriteRoomIds.includes(active.id) ? "★" : "☆"}
                </HeadBtn>
                <HeadBtn label="Stumm" onClick={() => setPrefs(toggleMute(userId, active.id))}>
                  {prefs?.mutedRoomIds.includes(active.id) ? "🔇" : "🔔"}
                </HeadBtn>
              </>
            )}
            <HeadBtn label="Suche" onClick={() => setSearchOpen((v) => !v)}>
              🔍
            </HeadBtn>
            <HeadBtn label="Export" onClick={() => void exportActive()}>
              ⬇
            </HeadBtn>
            <Link
              to="/"
              className="rounded-full border border-border px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground"
            >
              App
            </Link>
          </div>
        </header>

        <div className="sport-only sport-chat-topbar border-b border-border/70 bg-card/70 px-4 py-4 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur sm:px-6">
          <div className="community-conversation-heading">
            <button
              type="button"
              className="community-back"
              onClick={() => setMobileListOpen(true)}
              aria-label="Zur Chatliste"
            >
              <ArrowLeft aria-hidden="true" />
            </button>
            <span className="community-room-avatar">
              <MessageCircle aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h1>{headerTitle}</h1>
              <p>{mode === "local" ? "Lokal auf diesem Gerät" : "Community · Cloud"}</p>
            </div>
          </div>
          <details className="community-conversation-menu">
            <summary aria-label="Chataktionen">
              <MoreVertical aria-hidden="true" />
            </summary>
            <div className="community-conversation-actions">
              {active?.kind === "room" && userId && (
                <>
                  <HeadBtn
                    label="Favorit"
                    onClick={() => setPrefs(toggleFavoriteRoom(userId, active.id))}
                  >
                    {prefs?.favoriteRoomIds.includes(active.id) ? "★" : "☆"}
                  </HeadBtn>
                  <HeadBtn label="Stumm" onClick={() => setPrefs(toggleMute(userId, active.id))}>
                    {prefs?.mutedRoomIds.includes(active.id) ? "🔇" : "🔔"}
                  </HeadBtn>
                </>
              )}
              <HeadBtn label="Suche" onClick={() => setSearchOpen((v) => !v)}>
                🔍
              </HeadBtn>
              <HeadBtn label="Export" onClick={() => void exportActive()}>
                ⬇
              </HeadBtn>
              <Link
                to="/"
                className="rounded-xl border border-border/70 px-3 py-2 text-xs font-bold"
              >
                App
              </Link>
            </div>
          </details>
        </div>
        {searchOpen && (
          <div className="border-b border-border bg-card/40 px-3 py-2">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nachrichten durchsuchen…"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            {search.trim() && (
              <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto">
                {hits.length === 0 && (
                  <li className="text-xs text-muted-foreground">Keine Treffer</li>
                )}
                {hits.map((h) => (
                  <li key={h.id}>
                    <button
                      type="button"
                      className="w-full rounded-lg px-2 py-1.5 text-left text-xs hover:bg-secondary/50"
                      onClick={() => {
                        document
                          .getElementById(`msg-${h.id}`)
                          ?.scrollIntoView({ behavior: "smooth", block: "center" });
                      }}
                    >
                      <span className="line-clamp-2">{h.content}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {pinned.length > 0 && (
          <div className="flex gap-2 overflow-x-auto border-b border-border bg-primary/5 px-3 py-2">
            {pinned.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() =>
                  document
                    .getElementById(`msg-${p.id}`)
                    ?.scrollIntoView({ behavior: "smooth", block: "center" })
                }
                className="max-w-[200px] shrink-0 rounded-xl border border-primary/30 bg-background/60 px-2 py-1.5 text-left text-[11px]"
              >
                📌 <span className="line-clamp-2">{p.content}</span>
              </button>
            ))}
          </div>
        )}

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

        <div className="sport-chat-message-list flex-1 space-y-3 overflow-y-auto px-4 py-5 sm:px-6">
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
            const reply = m.reply_to_id ? messages.find((x) => x.id === m.reply_to_id) : null;
            const msgReactions = reactions.filter((r) => r.message_id === m.id);
            const grouped = msgReactions.reduce<Record<string, { count: number; mine: boolean }>>(
              (acc, r) => {
                const e = acc[r.emoji] ?? { count: 0, mine: false };
                e.count += 1;
                if (r.user_id === userId) e.mine = true;
                acc[r.emoji] = e;
                return acc;
              },
              {},
            );
            const isPinned = prefs?.pinnedMessageIds.includes(m.id);

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
                    {isPinned && <span>📌</span>}
                  </div>
                )}
                <div
                  className={`sport-chat-bubble max-w-[85%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
                    own
                      ? "rounded-br-sm bg-primary text-primary-foreground"
                      : m.user_id === "system"
                        ? "rounded-bl-sm border border-border bg-card/60 text-muted-foreground"
                        : "rounded-bl-sm border border-border/50 bg-secondary/90 text-secondary-foreground"
                  } ${isPinned ? "ring-1 ring-primary/40" : ""}`}
                >
                  {reply && (
                    <div className="mb-1.5 rounded-lg border-l-2 border-primary/60 bg-background/20 px-2 py-1 text-xs opacity-80">
                      <div className="font-medium">Antwort</div>
                      <div className="truncate">{reply.content}</div>
                    </div>
                  )}
                  <div className="whitespace-pre-wrap break-words">{m.content}</div>
                  {m.edited_at && <div className="mt-0.5 text-[10px] opacity-60">(bearbeitet)</div>}
                </div>

                {Object.keys(grouped).length > 0 && (
                  <div className={`flex flex-wrap gap-1 px-1 ${own ? "justify-end" : ""}`}>
                    {Object.entries(grouped).map(([emoji, info]) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          if (!userId || !active) return;
                          void reactToMessage(userId, m.id, emoji).then(() =>
                            refresh(userId, active),
                          );
                        }}
                        className={`rounded-full border px-2 py-0.5 text-xs ${
                          info.mine ? "border-primary bg-primary/15" : "border-border bg-card/50"
                        }`}
                      >
                        {emoji} {info.count}
                      </button>
                    ))}
                  </div>
                )}

                <div className={`flex flex-wrap gap-1 px-1 ${own ? "justify-end" : ""}`}>
                  {QUICK_EMOJIS.slice(0, 4).map((e) => (
                    <button
                      key={e}
                      type="button"
                      className="text-xs opacity-40 transition hover:opacity-100"
                      onClick={() => {
                        if (!userId || !active) return;
                        void reactToMessage(userId, m.id, e).then(() => refresh(userId, active));
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
                  {userId && (
                    <button
                      type="button"
                      className="text-[10px] text-muted-foreground"
                      onClick={() => setPrefs(togglePinMessage(userId, m.id))}
                    >
                      {isPinned ? "Lösen" : "Pin"}
                    </button>
                  )}
                  {own && m.user_id !== "system" && (
                    <>
                      <button
                        type="button"
                        className="text-[10px] text-muted-foreground"
                        onClick={() => {
                          const next = window.prompt("Bearbeiten", m.content);
                          if (next && userId && active) {
                            void editChatMessage(userId, m.id, next).then(() =>
                              refresh(userId, active),
                            );
                          }
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-[10px] text-destructive"
                        onClick={() => {
                          if (!userId || !active) return;
                          void deleteChatMessage(userId, m.id).then(() => refresh(userId, active));
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

        {replyTo && (
          <div className="flex items-center gap-2 border-t border-border bg-secondary/30 px-3 py-2 text-xs">
            <span className="min-w-0 flex-1 truncate">
              Antwort auf: <strong>{replyTo.content}</strong>
            </span>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              className="text-muted-foreground"
            >
              ×
            </button>
          </div>
        )}

        {/* Quick replies + workout share */}
        <div className="community-quick-replies flex gap-1.5 overflow-x-auto border-t border-border bg-card/40 px-3 py-2">
          {QUICK_REPLIES.map((q) => (
            <button
              key={q.id}
              type="button"
              onClick={() => void onSend(q.text)}
              className="shrink-0 rounded-full border border-border bg-background/60 px-2.5 py-1 text-[10px] font-medium"
            >
              {q.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => void onSend(workoutShareTemplate(todayReps || 20))}
            className="shrink-0 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary"
          >
            🏋️ Workout teilen
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void onSend();
          }}
          className="classic-only flex items-end gap-2 border-t border-border bg-card/60 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        >
          <button
            type="button"
            onClick={toggleVoice}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-sm ${
              listening
                ? "border-primary bg-primary/20 text-primary"
                : "border-border bg-secondary/40"
            }`}
            aria-label="Sprache"
          >
            🎤
          </button>
          <textarea
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (userId && active) saveDraft(userId, active.kind, active.id, e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void onSend();
              }
            }}
            placeholder={active ? "Nachricht…" : "Raum wählen…"}
            rows={1}
            disabled={!active}
            className="min-w-0 flex-1 resize-none rounded-xl border border-border bg-background/60 px-3 py-2.5 text-sm outline-none focus:border-primary disabled:opacity-50"
            style={{ maxHeight: 120 }}
          />
          <button
            type="submit"
            disabled={!active || !draft.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground disabled:opacity-40"
          >
            ↑
          </button>
        </form>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void onSend();
          }}
          className="sport-only sport-chat-composer flex items-end gap-3 border-t border-border/70 bg-card/80 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6"
        >
          <button
            type="button"
            onClick={toggleVoice}
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border text-lg ${listening ? "border-primary bg-primary/20 text-primary" : "border-border bg-secondary/40"}`}
            aria-label="Spracheingabe"
          >
            <Mic className="h-5 w-5" aria-hidden="true" />
          </button>
          <textarea
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (userId && active) saveDraft(userId, active.kind, active.id, e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void onSend();
              }
            }}
            placeholder={replyTo ? "Antwort schreiben…" : "Nachricht schreiben…"}
            rows={1}
            disabled={!active}
            className="min-h-12 min-w-0 flex-1 resize-none rounded-2xl border border-border/60 bg-background/70 px-4 py-3 text-sm outline-none focus:border-primary"
            style={{ maxHeight: 120 }}
          />
          <button
            type="submit"
            disabled={!active || !draft.trim()}
            className="flex h-12 items-center justify-center rounded-2xl bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-40"
          >
            <span className="sr-only">Nachricht senden</span>
            <ArrowUpRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </form>
        {toast && (
          <div className="pointer-events-none fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full border border-border bg-card px-4 py-2 text-xs shadow-lg">
            {toast}
          </div>
        )}
      </section>
      {newRoomOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Neuer Raum"
            className="w-full max-w-sm rounded-2xl border border-border bg-card p-4"
          >
            <div className="text-sm font-semibold">Neuer Raum</div>
            <input
              autoFocus
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void onCreateRoom()}
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
                onClick={() => void onCreateRoom()}
                className="flex-1 rounded-xl bg-primary py-2 text-sm font-semibold text-primary-foreground"
              >
                Erstellen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type SpeechRec = {
  lang: string;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult:
    ((ev: { results?: { [i: number]: { [j: number]: { transcript?: string } } } }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

function HeadBtn({
  children,
  label,
  onClick,
}: {
  children: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-xl border border-border text-sm"
    >
      {children}
    </button>
  );
}
