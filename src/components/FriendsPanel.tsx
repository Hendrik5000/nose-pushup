import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type PublicProfile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  level: number | null;
  xp: number | null;
  current_streak: number | null;
  battle_wins: number | null;
};

type Friendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted" | "declined" | "blocked";
  created_at: string;
};

type Row = { friendship: Friendship; other: PublicProfile };

type Tab = "friends" | "incoming" | "outgoing" | "find";

export function FriendsPanel({ userId }: { userId: string }) {
  const [tab, setTab] = useState<Tab>("friends");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<PublicProfile[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: fs } = await supabase
      .from("friendships" as never)
      .select("*")
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
      .order("created_at", { ascending: false });
    const friendships = (fs ?? []) as unknown as Friendship[];
    const otherIds = Array.from(
      new Set(
        friendships.map((f) => (f.requester_id === userId ? f.addressee_id : f.requester_id)),
      ),
    );
    let profiles: PublicProfile[] = [];
    if (otherIds.length > 0) {
      const { data: ps } = await supabase
        .from("public_profiles" as never)
        .select("id, display_name, avatar_url, level, xp, current_streak, battle_wins")
        .in("id", otherIds);
      profiles = (ps ?? []) as unknown as PublicProfile[];
    }
    const byId = new Map(profiles.map((p) => [p.id, p]));
    setRows(
      friendships.map((f) => {
        const otherId = f.requester_id === userId ? f.addressee_id : f.requester_id;
        return {
          friendship: f,
          other: byId.get(otherId) ?? { id: otherId, display_name: null, avatar_url: null, level: 0, xp: 0, current_streak: 0, battle_wins: 0 },
        };
      }),
    );
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const runSearch = async () => {
    setMsg(null);
    const q = search.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const { data } = await supabase
      .from("public_profiles" as never)
      .select("id, display_name, avatar_url, level, xp, current_streak, battle_wins")
      .ilike("display_name", `%${q}%`)
      .neq("id", userId)
      .limit(15);
    setResults((data ?? []) as unknown as PublicProfile[]);
  };

  const sendRequest = async (addresseeId: string) => {
    setBusy(addresseeId);
    setMsg(null);
    const { error } = await supabase
      .from("friendships" as never)
      .insert({ requester_id: userId, addressee_id: addresseeId, status: "pending" } as never);
    setBusy(null);
    if (error) {
      setMsg(error.message.includes("unique") ? "Anfrage besteht bereits" : "Anfrage fehlgeschlagen");
    } else {
      setMsg("Anfrage gesendet");
      load();
    }
  };

  const respond = async (id: string, status: "accepted" | "declined") => {
    setBusy(id);
    await supabase.from("friendships" as never).update({ status } as never).eq("id", id);
    setBusy(null);
    load();
  };

  const removeFriend = async (id: string) => {
    setBusy(id);
    await supabase.from("friendships" as never).delete().eq("id", id);
    setBusy(null);
    load();
  };

  const friends = rows.filter((r) => r.friendship.status === "accepted");
  const incoming = rows.filter(
    (r) => r.friendship.status === "pending" && r.friendship.addressee_id === userId,
  );
  const outgoing = rows.filter(
    (r) => r.friendship.status === "pending" && r.friendship.requester_id === userId,
  );

  return (
    <section className="mt-6 rounded-3xl border border-border bg-card/60 p-5 backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Freunde
        </h2>
        <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          {friends.length}
        </span>
      </div>

      <div className="flex overflow-x-auto rounded-full border border-border bg-background/60 p-0.5 text-[10px] uppercase tracking-[0.18em]">
        <TabBtn active={tab === "friends"} onClick={() => setTab("friends")}>
          Freunde
        </TabBtn>
        <TabBtn active={tab === "incoming"} onClick={() => setTab("incoming")}>
          Eingang {incoming.length > 0 && `(${incoming.length})`}
        </TabBtn>
        <TabBtn active={tab === "outgoing"} onClick={() => setTab("outgoing")}>
          Gesendet
        </TabBtn>
        <TabBtn active={tab === "find"} onClick={() => setTab("find")}>
          Suche
        </TabBtn>
      </div>

      {msg && <p className="mt-3 text-xs text-muted-foreground">{msg}</p>}

      <div className="mt-4 space-y-2">
        {loading && <p className="text-xs text-muted-foreground">Lade…</p>}

        {!loading && tab === "friends" && (
          <>
            {friends.length === 0 ? (
              <Empty text="Noch keine Freunde. Suche nach Nutzern und sende eine Anfrage." />
            ) : (
              friends.map((r) => (
                <FriendRow
                  key={r.friendship.id}
                  profile={r.other}
                  right={
                    <button
                      disabled={busy === r.friendship.id}
                      onClick={() => removeFriend(r.friendship.id)}
                      className="rounded-full border border-border px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground transition hover:border-destructive hover:text-destructive"
                    >
                      Entfernen
                    </button>
                  }
                />
              ))
            )}
          </>
        )}

        {!loading && tab === "incoming" && (
          <>
            {incoming.length === 0 ? (
              <Empty text="Keine offenen Anfragen." />
            ) : (
              incoming.map((r) => (
                <FriendRow
                  key={r.friendship.id}
                  profile={r.other}
                  right={
                    <div className="flex gap-1.5">
                      <button
                        disabled={busy === r.friendship.id}
                        onClick={() => respond(r.friendship.id, "accepted")}
                        className="rounded-full bg-primary px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-foreground transition active:scale-95"
                      >
                        Annehmen
                      </button>
                      <button
                        disabled={busy === r.friendship.id}
                        onClick={() => respond(r.friendship.id, "declined")}
                        className="rounded-full border border-border px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground transition hover:text-destructive"
                      >
                        Ablehnen
                      </button>
                    </div>
                  }
                />
              ))
            )}
          </>
        )}

        {!loading && tab === "outgoing" && (
          <>
            {outgoing.length === 0 ? (
              <Empty text="Keine gesendeten Anfragen." />
            ) : (
              outgoing.map((r) => (
                <FriendRow
                  key={r.friendship.id}
                  profile={r.other}
                  right={
                    <button
                      disabled={busy === r.friendship.id}
                      onClick={() => removeFriend(r.friendship.id)}
                      className="rounded-full border border-border px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground transition hover:text-destructive"
                    >
                      Zurückziehen
                    </button>
                  }
                />
              ))
            )}
          </>
        )}

        {!loading && tab === "find" && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runSearch()}
                placeholder="Nach Anzeigename suchen…"
                className="flex-1 rounded-xl border border-border bg-background/60 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
              <button
                onClick={runSearch}
                className="rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-primary-foreground transition active:scale-95"
              >
                Suchen
              </button>
            </div>
            {results.length === 0 && search.trim().length >= 2 && (
              <Empty text="Keine Treffer." />
            )}
            {results.map((p) => {
              const existing = rows.find((r) => r.other.id === p.id);
              return (
                <FriendRow
                  key={p.id}
                  profile={p}
                  right={
                    existing ? (
                      <span className="rounded-full border border-border px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                        {existing.friendship.status === "accepted" ? "Freund" : "Ausstehend"}
                      </span>
                    ) : (
                      <button
                        disabled={busy === p.id}
                        onClick={() => sendRequest(p.id)}
                        className="rounded-full bg-primary px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-foreground transition active:scale-95"
                      >
                        + Anfrage
                      </button>
                    )
                  }
                />
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function FriendRow({ profile, right }: { profile: PublicProfile; right: React.ReactNode }) {
  const initial = (profile.display_name || "?").slice(0, 1).toUpperCase();
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card/40 px-3 py-2.5">
      <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary text-sm font-semibold">
        {profile.avatar_url ? (
          <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
        ) : (
          initial
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">
          {profile.display_name || "Ohne Namen"}
        </div>
        <div className="truncate text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Lv {profile.level ?? 1} · {profile.xp ?? 0} XP · 🔥 {profile.current_streak ?? 0} · ⚔️{" "}
          {profile.battle_wins ?? 0}
        </div>
      </div>
      {right}
    </div>
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
      onClick={onClick}
      className={`flex-1 whitespace-nowrap rounded-full px-3 py-1.5 transition ${
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
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
