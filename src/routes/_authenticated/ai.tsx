import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { AiProviderSettings } from "@/components/AiProviderSettings";
import { buildAppContext, contextToSystemBlock } from "@/lib/ai-context";
import {
  classifyTask,
  loadProviders,
  pickProvider,
  toPayload,
  type AiTask,
} from "@/lib/ai-providers";
import { superAiChat } from "@/lib/super-ai.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/ai")({
  head: () => ({
    meta: [
      { title: "Super-AI — Nose Push" },
      {
        name: "description",
        content: "Multi-KI mit eigenen API-Keys, aufgabenbasiertem Routing und App-Kontext.",
      },
    ],
  }),
  component: SuperAiPage,
});

type Msg = {
  role: "user" | "assistant";
  content: string;
  meta?: { provider?: string; model?: string; task?: string };
};

const STORAGE_KEY = "super-ai-chat-v1";

const SUGGESTIONS = [
  "Erstell mir einen Trainingsplan für die Woche",
  "Wie war meine Woche?",
  "Tipps gegen Schulterschmerzen nach Push-Ups",
  "Fasse meinen Community-Chat kurz zusammen",
];

function SuperAiPage() {
  const send = useServerFn(superAiChat);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    });
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
    const task: AiTask = classifyTask(text);
    const provider = pickProvider(loadProviders(), task);
    if (!provider) {
      setError("Kein aktiver Provider. Öffne ⚙️ und hinterlege einen API-Key.");
      setSettingsOpen(true);
      return;
    }

    const nextMsgs: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(nextMsgs);
    setInput("");
    setLoading(true);
    try {
      let systemExtra = "";
      if (userId) {
        const ctx = await buildAppContext(userId);
        systemExtra = contextToSystemBlock(ctx);
      }
      const res = await send({
        data: {
          messages: nextMsgs.map(({ role, content }) => ({ role, content })),
          provider: toPayload(provider),
          task,
          systemExtra,
        },
      });
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: res.reply,
          meta: { provider: res.provider, model: res.model, task: res.task },
        },
      ]);
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

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pt-6 pb-4">
      <header className="flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <span aria-hidden>←</span> Zurück
        </Link>
        <div className="text-sm font-medium">⚡ Super-AI</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
            className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground"
          >
            ⚙️ Keys
          </button>
          <button
            type="button"
            onClick={clearChat}
            className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground hover:text-destructive"
          >
            Neu
          </button>
        </div>
      </header>

      {settingsOpen && (
        <section className="mt-3 rounded-3xl border border-border bg-card/60 p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            API-Provider
          </div>
          <AiProviderSettings />
        </section>
      )}

      <div
        ref={scrollRef}
        className="mt-4 flex-1 space-y-4 overflow-y-auto rounded-3xl border border-border bg-card/40 p-4 backdrop-blur"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-2xl">
              ⚡
            </div>
            <p className="text-sm font-semibold">Multi-KI für Nose-Pushup</p>
            <p className="text-xs text-muted-foreground">
              Hinterlege API-Keys · je nach Aufgabe wird das passende Modell gewählt · Zugriff auf Training &amp; Chat.
            </p>
            <div className="mt-2 grid w-full gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void submit(s)}
                  className="rounded-xl border border-border bg-background/60 px-3 py-2 text-left text-xs transition hover:border-primary/40"
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
                  : "max-w-[92%] space-y-1 text-sm leading-relaxed"
              }
            >
              <p className="whitespace-pre-wrap">{m.content}</p>
              {m.meta && (
                <div className="text-[10px] text-muted-foreground">
                  {m.meta.task} · {m.meta.provider}/{m.meta.model}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="text-xs text-muted-foreground">Super-AI denkt…</div>
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
          void submit();
        }}
        className="mt-3 flex items-end gap-2 rounded-2xl border border-border bg-card/60 p-2"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder="Frage Super-AI…"
          rows={1}
          className="min-w-0 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none"
          style={{ maxHeight: 140 }}
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40"
        >
          ↑
        </button>
      </form>
      <BottomNav />
    </main>
  );
}
