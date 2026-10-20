import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import {
  ArrowUp,
  ImagePlus,
  Menu,
  Mic,
  Plus,
  Settings2,
  Sparkles,
  X,
} from "lucide-react";
import { AiProviderSettings } from "@/components/AiProviderSettings";
import { BottomNav } from "@/components/BottomNav";
import {
  classifyTask,
  describeProviderSelection,
  loadProviders,
  selectProvider,
  toPayload,
  type AiTask,
} from "@/lib/ai-providers";
import { parseAiResponse } from "@/lib/ai-plan";
import { miraDraftId, readMiraDraft } from "@/lib/mira-handoff";
import { putAlo } from "@/lib/alo-store";
import { superAiChat } from "@/lib/super-ai.functions";
import {
  loadPersona,
  loadSessions,
  newSessionId,
  PERSONAS,
  saveSessions,
  type AiPersona,
  type AiSession,
} from "@/lib/super-ai-tools";
import { supabase } from "@/integrations/supabase/client";

type Msg = {
  role: "user" | "assistant";
  content: string;
  meta?: { provider?: string; model?: string; task?: string; routingReason?: string };
};

const SUGGESTIONS = [
  { label: "Ideen finden", prompt: "Gib mir 5 frische Ideen für mein nächstes Projekt." },
  { label: "Text schreiben", prompt: "Schreibe einen kurzen, freundlichen Textentwurf." },
  { label: "Einfach erklären", prompt: "Erkläre mir Routing bei KI-Modellen in einfachen Worten." },
  { label: "Foto analysieren", prompt: "Was siehst du auf dem Foto? Beschreibe es klar und hilf mir weiter." },
];

export function SuperAiPage() {
  const send = useServerFn(superAiChat);
  const [sessions, setSessions] = useState<AiSession[]>(() => loadSessions());
  const [activeId, setActiveId] = useState(() => loadSessions()[0]?.id ?? newSessionId());
  const [messages, setMessages] = useState<Msg[]>(() => loadSessions()[0]?.messages ?? []);
  const [input, setInput] = useState(() => readMiraDraft(loadSessions()[0]?.id ?? ""));
  const [loading, setLoading] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [persona] = useState<AiPersona>(() => loadPersona());
  const [userId, setUserId] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [lastTask, setLastTask] = useState<AiTask | null>(null);
  const generationRef = useRef(0);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const previewTask = input.trim() ? classifyTask(input) : (lastTask ?? "general");
  const providerPreview = selectProvider(loadProviders(userId), previewTask);
  const activeProvider = providerPreview.provider;

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    });
  }, []);

  useEffect(() => {
    try {
      putAlo("draft", { target: "mira", text: input }, miraDraftId(activeId));
    } catch {
      /* ignore */
    }
  }, [input, activeId]);

  useEffect(() => {
    if (!messages.length) return;
    const title = messages.find((m) => m.role === "user")?.content.slice(0, 40) || "Neuer Chat";
    setSessions(() => {
      const others = loadSessions().filter((s) => s.id !== activeId);
      const next: AiSession[] = [
        {
          id: activeId,
          title,
          updatedAt: new Date().toISOString(),
          messages: messages.slice(-60) as AiSession["messages"],
        },
        ...others,
      ];
      try {
        saveSessions(next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, [messages, activeId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const activeTitle = useMemo(() => {
    const s = sessions.find((x) => x.id === activeId);
    if (s?.title) return s.title;
    const firstUser = messages.find((m) => m.role === "user");
    return firstUser ? firstUser.content.slice(0, 32) : "Neuer Chat";
  }, [sessions, activeId, messages]);

  const startNewSession = () => {
    generationRef.current += 1;
    setLoading(false);
    const id = newSessionId();
    setActiveId(id);
    setMessages([]);
    setInput(readMiraDraft(id));
    setPendingImage(null);
    setMenuOpen(false);
    setError(null);
  };

  const switchSession = (id: string) => {
    generationRef.current += 1;
    setLoading(false);
    const s = sessions.find((x) => x.id === id);
    setActiveId(id);
    setMessages((s?.messages as Msg[]) ?? []);
    setInput(readMiraDraft(id));
    setPendingImage(null);
    setMenuOpen(false);
    setError(null);
  };

  const onPickImage = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 1_200_000) {
      setError("Foto max. ca. 1,2 MB — bitte kleiner wählen.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setPendingImage(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const submit = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    const imageDataUrl = pendingImage;
    if ((!text && !imageDataUrl) || loading) return;
    setError(null);
    const task: AiTask = classifyTask(text || "Was siehst du auf dem Foto?", {
      hasImage: Boolean(imageDataUrl),
    });
    setLastTask(task);
    const selection = selectProvider(loadProviders(userId), task);
    const provider = selection.provider;
    if (!provider) {
      setError("Kein aktiver KI-Anbieter. Öffne die Einstellungen und hinterlege einen API-Schlüssel.");
      setSettingsOpen(true);
      return;
    }
    const userContent =
      text || (imageDataUrl ? "📷 Foto angehängt — bitte beschreiben und helfen." : "");
    const nextMsgs: Msg[] = [...messages, { role: "user", content: userContent }];
    setMessages(nextMsgs);
    setInput("");
    setPendingImage(null);
    const generation = ++generationRef.current;
    setLoading(true);
    try {
      let systemExtra = `Du bist Mira, die vielseitige KI von Alo. Antworte auf Deutsch, klar und hilfreich. ${PERSONAS.find((p) => p.id === persona)?.system ?? ""}`;
      if (imageDataUrl) {
        systemExtra +=
          "\n\nDer Nutzer hat ein Foto angehängt. Beschreibe relevante Inhalte und hilf konkret. Erfinde keine nicht sichtbaren Details.";
      }
      if (generation !== generationRef.current) return;
      const res = await send({
        data: {
          messages: nextMsgs.map(({ role, content }, index) => ({
            role,
            content,
            ...(index === nextMsgs.length - 1 && imageDataUrl ? { imageDataUrl } : {}),
          })),
          provider: toPayload(provider),
          task,
          systemExtra,
        },
      });
      if (generation !== generationRef.current) return;
      const parsed = parseAiResponse(res.reply);
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: parsed.reply || res.reply,
          meta: {
            provider: res.provider,
            model: res.model,
            task: res.task,
            routingReason: describeProviderSelection(selection, task),
          },
        },
      ]);
    } catch (e) {
      if (generation !== generationRef.current) return;
      const msg = e instanceof Error ? e.message : "Fehler";
      setError(msg);
      setMessages((m) => [...m, { role: "assistant", content: `⚠️ ${msg}` }]);
    } finally {
      if (generation === generationRef.current) setLoading(false);
    }
  };

  const toggleVoice = () => {
    type Rec = {
      lang: string;
      continuous: boolean;
      interimResults: boolean;
      onresult:
        | ((e: { results: { [key: number]: { [key: number]: { transcript: string } } } }) => void)
        | null;
      onerror: (() => void) | null;
      onend: (() => void) | null;
      start: () => void;
      stop: () => void;
    };
    const SR = (window as unknown as { webkitSpeechRecognition?: new () => Rec }).webkitSpeechRecognition;
    if (!SR) {
      setError("Spracheingabe wird von diesem Browser nicht unterstützt.");
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const rec = new SR();
    rec.lang = "de-DE";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e) => {
      const t = e.results[0]?.[0]?.transcript;
      if (t) setInput((prev) => (prev ? `${prev} ${t}` : t));
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  };

  const empty = messages.length === 0 && !loading;

  return (
    <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-col bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-500/10 via-background to-background pb-28 text-foreground">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border/40 bg-background/80 px-4 py-3 backdrop-blur-xl">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-secondary/60"
          aria-label="Menü"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="min-w-0 text-center">
          <div className="truncate text-sm font-semibold tracking-tight">Mira</div>
          <div className="truncate text-[11px] text-muted-foreground">
            {activeProvider?.label ?? "Kein Anbieter"} · {activeTitle}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={startNewSession}
            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-secondary/60"
            aria-label="Neuer Chat"
          >
            <Plus className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-secondary/60"
            aria-label="Einstellungen"
          >
            <Settings2 className="h-5 w-5" />
          </button>
        </div>
      </header>

      {menuOpen && (
        <div className="absolute inset-x-0 top-[57px] z-30 mx-3 max-h-[50vh] overflow-y-auto rounded-3xl border border-border/60 bg-card/95 p-3 shadow-2xl backdrop-blur-xl">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Chats
            </span>
            <button type="button" onClick={() => setMenuOpen(false)} className="rounded-full p-1 hover:bg-secondary/50">
              <X className="h-4 w-4" />
            </button>
          </div>
          {sessions.length === 0 && (
            <p className="px-2 py-3 text-sm text-muted-foreground">Noch keine Chats.</p>
          )}
          {sessions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => switchSession(s.id)}
              className={`mb-1 block w-full rounded-2xl px-3 py-2.5 text-left text-sm transition ${
                s.id === activeId ? "bg-primary/15 font-semibold" : "hover:bg-secondary/50"
              }`}
            >
              {s.title || "Chat"}
            </button>
          ))}
          <Link
            to="/"
            className="mt-2 block rounded-2xl px-3 py-2 text-center text-xs font-medium text-primary hover:bg-secondary/40"
          >
            Zur Übersicht
          </Link>
        </div>
      )}

      {settingsOpen && (
        <div className="mx-4 mt-3 rounded-3xl border border-border/60 bg-card/90 p-4 shadow-lg backdrop-blur">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">KI-Anbieter & API-Keys</h2>
            <button type="button" onClick={() => setSettingsOpen(false)} className="text-xs text-primary">
              Fertig
            </button>
          </div>
          <AiProviderSettings userId={userId} />
        </div>
      )}

      {error && (
        <div className="mx-4 mt-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      <div ref={scrollRef} className="flex flex-1 flex-col overflow-y-auto px-4 pb-4 pt-6">
        {empty ? (
          <div className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 via-violet-500 to-amber-400 shadow-lg shadow-violet-500/20">
              <Sparkles className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Hallo, ich bin Mira</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Frag mich etwas, lade ein Foto hoch oder starte mit einer Idee.
              </p>
            </div>
            <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => void submit(s.prompt)}
                  className="rounded-2xl border border-border/70 bg-card/70 px-4 py-3 text-left text-sm shadow-sm transition hover:border-primary/40 hover:bg-card"
                >
                  <span className="font-medium">{s.label}</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground line-clamp-2">
                    {s.prompt}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {m.role === "assistant" && (
                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 via-violet-500 to-amber-400">
                    <Sparkles className="h-3.5 w-3.5 text-white" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-[1.35rem] px-4 py-3 text-[15px] leading-relaxed ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary/50 text-foreground"
                  }`}
                >
                  <div className="whitespace-pre-wrap">{m.content}</div>
                  {m.meta?.routingReason && (
                    <div className="mt-2 text-[10px] opacity-70">{m.meta.routingReason}</div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 via-violet-500 to-amber-400">
                  <Sparkles className="h-3.5 w-3.5 animate-pulse text-white" />
                </div>
                <div className="rounded-[1.35rem] bg-secondary/50 px-4 py-3 text-sm text-muted-foreground">
                  Mira denkt …
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-16 z-20 flex justify-center px-3">
        <div className="pointer-events-auto w-full max-w-2xl">
          {pendingImage && (
            <div className="mb-2 flex items-center gap-2 rounded-2xl border border-border/60 bg-card/95 px-3 py-2 shadow-lg backdrop-blur">
              <img src={pendingImage} alt="Anhang" className="h-12 w-12 rounded-xl object-cover" />
              <span className="min-w-0 flex-1 text-xs text-muted-foreground">Foto wird mitgesendet</span>
              <button
                type="button"
                onClick={() => setPendingImage(null)}
                className="rounded-full p-1.5 hover:bg-secondary/60"
                aria-label="Foto entfernen"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          <form
            className="flex items-end gap-1 rounded-[1.75rem] border border-border/60 bg-card/95 p-2 shadow-xl shadow-black/10 backdrop-blur-xl"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                onPickImage(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={loading}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary/70 disabled:opacity-40"
              aria-label="Foto anhängen"
            >
              <ImagePlus className="h-5 w-5" />
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
              placeholder="Frag Mira etwas…"
              aria-label="Nachricht an Mira"
              rows={1}
              disabled={loading}
              className="max-h-32 min-h-11 min-w-0 flex-1 resize-none bg-transparent px-1 py-2.5 text-[15px] outline-none placeholder:text-muted-foreground/70"
            />
            <button
              type="button"
              onClick={toggleVoice}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                listening ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-secondary/70"
              }`}
              aria-label="Spracheingabe"
              aria-pressed={listening}
            >
              <Mic className="h-5 w-5" />
            </button>
            <button
              type="submit"
              disabled={loading || (!input.trim() && !pendingImage)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md disabled:opacity-35"
              aria-label="Senden"
            >
              <ArrowUp className="h-5 w-5" />
            </button>
          </form>
          <p className="mt-1.5 text-center text-[10px] text-muted-foreground/80">
            Mira kann Fehler machen · Prüfe wichtige Infos
          </p>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
