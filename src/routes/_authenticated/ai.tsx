import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  exportChatMarkdown,
  loadFavPrompts,
  loadPersona,
  loadSessions,
  newSessionId,
  PERSONAS,
  savePersona,
  saveSessions,
  SUPER_TOOLS,
  toggleFavPrompt,
  type AiPersona,
  type AiSession,
} from "@/lib/super-ai-tools";

export const Route = createFileRoute("/_authenticated/ai")({
  head: () => ({
    meta: [
      { title: "Super-AI — Nose Push" },
      {
        name: "description",
        content: "Multi-KI mit Tools, Personas, Sessions und App-Kontext.",
      },
    ],
  }),
  component: SuperAiPage,
});

type Msg = AiSession["messages"][number];

function SuperAiPage() {
  const send = useServerFn(superAiChat);
  const [sessions, setSessions] = useState<AiSession[]>(() => loadSessions());
  const [activeId, setActiveId] = useState<string>(() => {
    const list = loadSessions();
    return list[0]?.id ?? newSessionId();
  });
  const [messages, setMessages] = useState<Msg[]>(() => loadSessions()[0]?.messages ?? []);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(true);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [persona, setPersona] = useState<AiPersona>(() => loadPersona());
  const [favs, setFavs] = useState<string[]>(() => loadFavPrompts());
  const [userId, setUserId] = useState<string | null>(null);
  const [contextHint, setContextHint] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [lastTask, setLastTask] = useState<AiTask | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  const activeTitle = useMemo(() => {
    const s = sessions.find((x) => x.id === activeId);
    if (s?.title) return s.title;
    const firstUser = messages.find((m) => m.role === "user");
    return firstUser ? firstUser.content.slice(0, 28) : "Neuer Chat";
  }, [sessions, activeId, messages]);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    });
  }, []);

  // Persist active session
  useEffect(() => {
    const title =
      messages.find((m) => m.role === "user")?.content.slice(0, 40) || "Neuer Chat";
    setSessions((prev) => {
      const others = prev.filter((s) => s.id !== activeId);
      const next: AiSession[] = [
        {
          id: activeId,
          title,
          updatedAt: new Date().toISOString(),
          messages: messages.slice(-60),
        },
        ...others,
      ].slice(0, 12);
      saveSessions(next);
      return next;
    });
  }, [messages, activeId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const switchSession = (id: string) => {
    const s = sessions.find((x) => x.id === id);
    setActiveId(id);
    setMessages(s?.messages ?? []);
    setSessionsOpen(false);
    setError(null);
  };

  const startNewSession = () => {
    const id = newSessionId();
    setActiveId(id);
    setMessages([]);
    setSessionsOpen(false);
    setError(null);
  };

  const submit = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || loading) return;
    setError(null);
    const task: AiTask = classifyTask(text);
    setLastTask(task);
    const provider = pickProvider(loadProviders(), task);
    if (!provider) {
      setError("Kein aktiver Provider. Öffne Keys und hinterlege einen API-Key.");
      setSettingsOpen(true);
      return;
    }

    const nextMsgs: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(nextMsgs);
    setInput("");
    setLoading(true);
    try {
      let systemExtra = "";
      const personaBlock = PERSONAS.find((p) => p.id === persona)?.system ?? "";
      if (userId) {
        const ctx = await buildAppContext(userId);
        systemExtra = `${personaBlock}\n\n${contextToSystemBlock(ctx)}`;
        setContextHint(
          `Kontext: ${ctx.weekReps} Reps/7d · ${ctx.recentWorkouts.length} Workouts · ${ctx.health.length} Health-Tage`,
        );
      } else {
        systemExtra = personaBlock;
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

  const regenerate = () => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    // Drop trailing assistant replies after last user
    let cut = messages.length - 1;
    while (cut >= 0 && messages[cut]?.role === "assistant") cut -= 1;
    setMessages(messages.slice(0, cut + 1));
    void submit(lastUser.content);
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  };

  const exportChat = () => {
    const md = exportChatMarkdown(activeTitle, messages);
    void copyText(md);
    setError(null);
    setContextHint("Chat als Markdown in die Zwischenablage kopiert.");
  };

  const toggleVoice = () => {
    const SR =
      typeof window !== "undefined"
        ? (window as unknown as {
            SpeechRecognition?: new () => SpeechRecognitionLike;
            webkitSpeechRecognition?: new () => SpeechRecognitionLike;
          }).SpeechRecognition ||
          (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike })
            .webkitSpeechRecognition
        : undefined;

    if (!SR) {
      setError("Spracheingabe wird in diesem Browser nicht unterstützt.");
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
    rec.onresult = (ev: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => {
      const t = ev.results[0]?.[0]?.transcript ?? "";
      if (t) setInput((prev) => (prev ? `${prev} ${t}` : t));
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  };

  const onPersona = (p: AiPersona) => {
    setPersona(p);
    savePersona(p);
  };

  return (
    <main className="mx-auto flex h-[100dvh] min-h-0 w-full max-w-md flex-col overflow-hidden px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-0">
      {/* Header */}
      <header className="relative shrink-0 overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/20 via-card/80 to-background p-4 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div>
            <Link to="/" className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              ← Übersicht
            </Link>
            <h1 className="mt-1 text-xl font-bold tracking-tight">Super-AI</h1>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{activeTitle}</p>
          </div>
          <div className="flex flex-wrap justify-end gap-1.5">
            <IconBtn label="Chats" onClick={() => setSessionsOpen((v) => !v)}>
              💬
            </IconBtn>
            <IconBtn label="Tools" onClick={() => setToolsOpen((v) => !v)}>
              ✦
            </IconBtn>
            <IconBtn label="Kontext" onClick={() => setContextOpen((v) => !v)}>
              ⧉
            </IconBtn>
            <IconBtn label="Keys" onClick={() => setSettingsOpen((v) => !v)}>
              ⚙️
            </IconBtn>
          </div>
        </div>

        {/* Personas */}
        <div className="mt-3 flex gap-1.5">
          {PERSONAS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onPersona(p.id)}
              className={`flex-1 rounded-xl border px-2 py-1.5 text-center transition ${
                persona === p.id
                  ? "border-primary bg-primary/20 text-foreground"
                  : "border-border/60 bg-background/30 text-muted-foreground"
              }`}
            >
              <div className="text-[11px] font-semibold">{p.label}</div>
              <div className="text-[9px] opacity-70">{p.hint}</div>
            </button>
          ))}
        </div>

        {(lastTask || contextHint) && (
          <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
            {lastTask && (
              <span className="rounded-full border border-border bg-background/40 px-2 py-0.5">
                Task: {lastTask}
              </span>
            )}
            {contextHint && (
              <span className="rounded-full border border-border bg-background/40 px-2 py-0.5">
                {contextHint}
              </span>
            )}
          </div>
        )}
      </header>

      {/* Sessions drawer */}
      {sessionsOpen && (
        <section className="mt-3 rounded-2xl border border-border bg-card/80 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Sessions</span>
            <button type="button" onClick={startNewSession} className="text-xs font-semibold text-primary">
              + Neu
            </button>
          </div>
          <ul className="max-h-40 space-y-1 overflow-y-auto">
            {sessions.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => switchSession(s.id)}
                  className={`w-full rounded-xl px-3 py-2 text-left text-xs ${
                    s.id === activeId ? "bg-primary/15 text-foreground" : "hover:bg-secondary/50"
                  }`}
                >
                  <div className="font-medium">{s.title || "Chat"}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {new Date(s.updatedAt).toLocaleString("de-DE", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </button>
              </li>
            ))}
            {sessions.length === 0 && (
              <li className="text-xs text-muted-foreground">Noch keine gespeicherten Chats.</li>
            )}
          </ul>
        </section>
      )}

      {settingsOpen && (
        <section className="mt-3 rounded-2xl border border-border bg-card/80 p-4">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            API-Provider
          </div>
          <AiProviderSettings />
        </section>
      )}

      {contextOpen && (
        <section className="mt-3 rounded-2xl border border-border bg-card/80 p-3 text-xs text-muted-foreground">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em]">App-Kontext</div>
          Super-AI liest Profil, Streak, Workouts, Health und Chat (lokal/Supabase), sobald du sendest.
          Persona: <strong className="text-foreground">{persona}</strong>.
          {contextHint && <p className="mt-1 text-foreground">{contextHint}</p>}
        </section>
      )}

      {/* 10 Tools */}
      {toolsOpen && (
        <section className="mt-3">
          <div className="mb-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            10 Funktionen
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {SUPER_TOOLS.map((t) => (
              <button
                key={t.id}
                type="button"
                disabled={loading}
                onClick={() => void submit(t.prompt)}
                className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-card/60 px-1 py-2 text-center transition active:scale-[0.97] disabled:opacity-50"
                title={t.description}
              >
                <span className="text-lg leading-none">{t.icon}</span>
                <span className="text-[9px] font-medium leading-tight">{t.label}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Favorites */}
      {favs.length > 0 && (
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
          {favs.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => void submit(f)}
              className="shrink-0 rounded-full border border-border bg-secondary/40 px-2.5 py-1 text-[10px]"
            >
              ★ {f.slice(0, 32)}
              {f.length > 32 ? "…" : ""}
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div
        ref={scrollRef}
        className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain rounded-3xl border border-border bg-card/30 p-3 pb-5 backdrop-blur [scrollbar-width:thin]"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-3xl shadow-inner">
              ⚡
            </div>
            <p className="text-sm font-semibold">Dein Multi-KI Coach</p>
            <p className="max-w-[260px] text-xs text-muted-foreground">
              Wähle eine Persona, tippe auf ein Tool oder frag frei — Routing wählt das passende Modell.
            </p>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                m.role === "user"
                  ? "max-w-[88%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5 text-sm text-primary-foreground shadow-sm"
                  : "max-w-[92%] rounded-2xl rounded-bl-md border border-border/80 bg-background/70 px-3.5 py-2.5 text-sm leading-relaxed shadow-sm"
              }
            >
              <p className="whitespace-pre-wrap">{m.content}</p>
              {m.role === "assistant" && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {m.meta && (
                    <span className="text-[10px] text-muted-foreground">
                      {m.meta.task} · {m.meta.provider}/{m.meta.model}
                    </span>
                  )}
                  <button
                    type="button"
                    className="text-[10px] font-medium text-primary"
                    onClick={() => void copyText(m.content)}
                  >
                    Kopieren
                  </button>
                  <button
                    type="button"
                    className="text-[10px] font-medium text-muted-foreground"
                    onClick={() => setFavs(toggleFavPrompt(m.content.slice(0, 120)))}
                  >
                    ★ Merken
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex gap-1">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:300ms]" />
            </span>
            Super-AI denkt…
          </div>
        )}
      </div>

      {error && (
        <div className="mt-2 rounded-xl border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* Composer */}
      <div className="mt-2 shrink-0 rounded-2xl border border-border bg-card/70 p-2 shadow-sm backdrop-blur">
        <div className="mb-1.5 flex gap-1">
          <SmallAction onClick={regenerate} disabled={loading || messages.length === 0}>
            Neu generieren
          </SmallAction>
          <SmallAction onClick={exportChat} disabled={messages.length === 0}>
            Export
          </SmallAction>
          <SmallAction
            onClick={() => {
              setMessages([]);
              setError(null);
            }}
          >
            Leeren
          </SmallAction>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="flex items-end gap-2"
        >
          <button
            type="button"
            onClick={toggleVoice}
            className={`flex size-11 shrink-0 items-center justify-center rounded-xl border text-sm transition active:scale-95 ${
              listening
                ? "border-primary bg-primary/20 text-primary"
                : "border-border bg-secondary/40 text-muted-foreground"
            }`}
            aria-label="Spracheingabe"
          >
            🎤
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
            placeholder="Frag Super-AI…"
            rows={1}
            className="min-h-11 min-w-0 flex-1 resize-none rounded-xl bg-background/40 px-3 py-2.5 text-base outline-none ring-0 placeholder:text-muted-foreground/70 focus:bg-background/70"
            style={{ maxHeight: 140 }}
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-sm transition active:scale-95 disabled:opacity-40"
          >
            ↑
          </button>
        </form>
      </div>

      <div className="shrink-0"><BottomNav /></div>
    </main>
  );
}

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((ev: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

function IconBtn({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex size-11 items-center justify-center rounded-xl border border-border/70 bg-background/50 text-sm backdrop-blur transition active:scale-95"
    >
      {children}
    </button>
  );
}

function SmallAction({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="min-h-10 rounded-xl border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition active:scale-95 disabled:opacity-40"
    >
      {children}
    </button>
  );
}
