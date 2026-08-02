import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { coachChat } from "@/lib/coach-chat.functions";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/_authenticated/coach")({
  head: () => ({
    meta: [
      { title: "Smart Coach — Nosy Push-Ups" },
      { name: "description", content: "Chatte mit deinem persönlichen KI-Fitness-Coach. Er kennt deine Werte und loggt Trainings für dich." },
    ],
  }),
  component: CoachChatPage,
});

type Msg = {
  role: "user" | "assistant";
  content: string;
  actions?: string[];
};

const STORAGE_KEY = "coach-chat-v1";

const SUGGESTIONS = [
  "Ich habe gerade 15 Push-Ups gemacht",
  "Wie kann ich meine Brust wachsen lassen?",
  "Wie war meine Woche?",
  "Gib mir einen Trainingsplan für morgen",
];

function CoachChatPage() {
  const send = useServerFn(coachChat);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Persist chat in localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Msg[];
        if (Array.isArray(parsed)) setMessages(parsed);
      }
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40)));
    } catch {
      /* noop */
    }
  }, [messages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);


  const submit = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || loading) return;
    setError(null);
    const nextMsgs: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(nextMsgs);
    setInput("");
    setLoading(true);
    try {
      const res = await send({ data: { messages: nextMsgs.map(({ role, content }) => ({ role, content })) } });
      setMessages((m) => [...m, { role: "assistant", content: res.reply, actions: res.actions }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Fehler";
      setError(msg);
      setMessages((m) => [...m, { role: "assistant", content: `⚠️ ${msg}` }]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* noop */
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pt-6 pb-4">
      <header className="flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <span aria-hidden>←</span> Zurück
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">🧠 Smart Coach</span>
        </div>
        <button
          onClick={clearChat}
          className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-destructive"
          title="Chat leeren"
        >
          Neu
        </button>
      </header>

      <div
        ref={scrollRef}
        className="mt-4 flex-1 space-y-4 overflow-y-auto rounded-3xl border border-border bg-card/40 p-4 backdrop-blur"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-2xl">
              🧠
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Dein Fitness-Coach</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Ich kenne deine Werte. Frag nach Tipps, log dein Training per Text oder frag nach Progress.
              </p>
            </div>
            <div className="mt-2 grid w-full gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => submit(s)}
                  className="rounded-xl border border-border bg-background/60 px-3 py-2 text-left text-xs text-foreground transition hover:border-primary/40"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                m.role === "user"
                  ? "max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground"
                  : "max-w-[92%] space-y-2 text-sm leading-relaxed text-foreground"
              }
            >
              <p className="whitespace-pre-wrap">{m.content}</p>
              {m.actions && m.actions.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {m.actions.map((a, j) => (
                    <span
                      key={j}
                      className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
                    >
                      ✓ {a}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1.5 rounded-2xl bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
              <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
              <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
              <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
              <span className="ml-1.5">Coach denkt…</span>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-2 rounded-xl border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          {error}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="mt-3 flex items-end gap-2 rounded-2xl border border-border bg-card/60 p-2 backdrop-blur"
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Nachricht an den Coach…"
          rows={1}
          className="min-w-0 flex-1 resize-none overflow-y-auto bg-transparent px-2 py-2 text-sm text-foreground outline-none placeholder:truncate placeholder:text-muted-foreground/60"
          style={{ maxHeight: 140 }}
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition active:scale-[0.95] disabled:opacity-40"
          aria-label="Senden"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </form>
      <BottomNav />
    </main>
  );
}
