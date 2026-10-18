import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { FriendsPanel } from "@/components/FriendsPanel";
import { NEXUS_CHAT_URL, openNexusChat } from "@/lib/nexus";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({
    meta: [
      { title: "Chat — Nosy Push-Ups" },
      {
        name: "description",
        content: "Community, Freunde und Echtzeit-Chat — integriert in Nosy Push-Ups.",
      },
    ],
  }),
  component: ChatPage,
});

function ChatPage() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id ?? null);
    })();
  }, []);

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pt-6 pb-4">
      <header className="flex items-center justify-between">
        <Link
          to="/"
          className="text-xs uppercase tracking-[0.25em] text-muted-foreground transition hover:text-foreground"
        >
          ← Zurück
        </Link>
        <span className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Chat</span>
        <span className="w-10" />
      </header>

      <section className="mt-6 rounded-3xl border border-primary/25 bg-primary/5 p-5 backdrop-blur">
        <div className="flex items-start gap-3">
          <span className="text-3xl leading-none">💬</span>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-[0.2em] text-primary">Nexus Chat</div>
            <h1 className="mt-1 text-lg font-semibold text-foreground">Community & Messenger</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Nose-Pushup ist die Haupt-App. Chat läuft vorerst über Nexus Chat (Räume, DMs,
              Reaktionen). Sobald die Tabellen hier migriert sind, kommt der Chat nativ rein.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => openNexusChat("/")}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground transition active:scale-[0.98]"
        >
          Nexus Chat öffnen →
        </button>
        <p className="mt-2 text-center text-[10px] text-muted-foreground">
          {NEXUS_CHAT_URL.replace(/^https?:\/\//, "")}
        </p>
      </section>

      <section className="mt-4 grid grid-cols-2 gap-2">
        <Link
          to="/leaderboard"
          className="rounded-2xl border border-border bg-card/50 px-3 py-3 text-center backdrop-blur transition active:scale-[0.98] hover:border-primary/40"
        >
          <div className="text-xl">🏆</div>
          <div className="mt-1 text-[11px] font-medium text-foreground">Leaderboard</div>
        </Link>
        <Link
          to="/battle"
          className="rounded-2xl border border-border bg-card/50 px-3 py-3 text-center backdrop-blur transition active:scale-[0.98] hover:border-primary/40"
        >
          <div className="text-xl">⚔️</div>
          <div className="mt-1 text-[11px] font-medium text-foreground">Battle</div>
        </Link>
        <Link
          to="/clubs"
          className="rounded-2xl border border-border bg-card/50 px-3 py-3 text-center backdrop-blur transition active:scale-[0.98] hover:border-primary/40"
        >
          <div className="text-xl">🛡️</div>
          <div className="mt-1 text-[11px] font-medium text-foreground">Clubs</div>
        </Link>
        <button
          type="button"
          onClick={() => openNexusChat("/")}
          className="rounded-2xl border border-border bg-card/50 px-3 py-3 text-center backdrop-blur transition active:scale-[0.98] hover:border-primary/40"
        >
          <div className="text-xl">📨</div>
          <div className="mt-1 text-[11px] font-medium text-foreground">Direktnachrichten</div>
        </button>
      </section>

      <section className="mt-5 rounded-3xl border border-border bg-card/60 p-4 backdrop-blur">
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Freunde</div>
        <h2 className="mt-1 text-sm font-semibold text-foreground">Dein Kreis in Nose-Pushup</h2>
        <div className="mt-4">
          {userId ? (
            <FriendsPanel userId={userId} />
          ) : (
            <p className="text-xs text-muted-foreground">Lade…</p>
          )}
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-border bg-card/40 p-4 text-xs leading-relaxed text-muted-foreground">
        <strong className="text-foreground">Phase 2 (Lovable):</strong> Chat-Tabellen
        (rooms, messages, conversations, reactions) ins Nose-Pushup-Supabase migrieren, dann
        ChatShell nativ einbinden — ein Login, eine App.
      </section>

      <BottomNav />
    </main>
  );
}
