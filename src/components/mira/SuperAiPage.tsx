import {
  Mic,
  ArrowUp,
  Plus,
  Settings2,
  Sparkles,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { AiProviderSettings } from "@/components/AiProviderSettings";
import { MiraPhotoAttach } from "@/components/MiraPhotoAttach";
import { BottomNav } from "@/components/BottomNav";
import { SportPageIntro } from "@/components/SportPageIntro";
import {
  classifyTask,
  describeProviderSelection,
  loadProviders,
  selectProvider,
  toPayload,
  type AiTask,
} from "@/lib/ai-providers";
import { parseAiResponse } from "@/lib/ai-plan";
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
import { miraDraftId, readMiraDraft } from "@/lib/mira-handoff";
import { putAlo } from "@/lib/alo-store";
import { supabase } from "@/integrations/supabase/client";

type Msg = {
  role: "user" | "assistant";
  content: string;
  meta?: { provider?: string; model?: string; task?: string; routingReason?: string };
};

type SportAiView = "coach" | "chat" | "history";

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
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [sportAiView, setSportAiView] = useState<SportAiView>("chat");
  const [persona] = useState<AiPersona>(() => loadPersona());
  const [userId, setUserId] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [lastTask, setLastTask] = useState<AiTask | null>(null);
  const generationRef = useRef(0);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const previewTask = input.trim() ? classifyTask(input) : (lastTask ?? "general");
  const providerPreview = selectProvider(loadProviders(userId), previewTask);
  const activeProvider = providerPreview.provider;
  const providerPreviewReason = describeProviderSelection(providerPreview, previewTask);

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
    return firstUser ? firstUser.content.slice(0, 28) : "Neuer Chat";
  }, [sessions, activeId, messages]);

  const startNewSession = () => {
    generationRef.current += 1;
    setLoading(false);
    const id = newSessionId();
    setActiveId(id);
    setMessages([]);
    setInput(readMiraDraft(id));
    setPendingImage(null);
    setSessionsOpen(false);
    setError(null);
    setSportAiView("chat");
  };

  const switchSession = (id: string) => {
    generationRef.current += 1;
    setLoading(false);
    const s = sessions.find((x) => x.id === id);
    setActiveId(id);
    setMessages((s?.messages as Msg[]) ?? []);
    setInput(readMiraDraft(id));
    setPendingImage(null);
    setSessionsOpen(false);
    setError(null);
    setSportAiView("chat");
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
      setError("Kein aktiver KI-Anbieter. Öffne Zugangsdaten und hinterlege einen API-Schlüssel.");
      setSettingsOpen(true);
      return;
    }
    setSportAiView("chat");
    const userContent =
      text || (imageDataUrl ? "📷 Foto angehängt — bitte beschreiben und helfen." : "");
    const nextMsgs: Msg[] = [...messages, { role: "user", content: userContent }];
    setMessages(nextMsgs);
    setInput("");
    setPendingImage(null);
    const generation = ++generationRef.current;
    setLoading(true);
    try {
      let systemExtra = `Du bist Mira, die vielseitige allgemeine KI von Alo (All in one). Hilf bei Alltag, Wissen, Schreiben, Ideen, Lernen und Planung. Sei verlässlich und klar. Antworte auf Deutsch. ${PERSONAS.find((p) => p.id === persona)?.system ?? ""}`;
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

  const suggestions = ["Ideen", "Text entwerfen", "Einfach erklären"];

  return (
    <div
      className={`sport-only sport-ai-page mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col gap-5 px-5 py-6 pb-28 sm:px-8 ${
        sportAiView === "chat" ? "sport-ai-chat-mode" : ""
      }`}
    >
      {sportAiView === "chat" ? (
        <div className="sport-ai-compact-heading" aria-label="Chat-Steuerung">
          <div className="sport-ai-model-status" aria-live="polite">
            <span className="sport-ai-model-dot" aria-hidden="true" />
            <span>Mira</span>
            <span className="text-[10px] text-muted-foreground">
              Vorschau: {activeProvider?.label ?? "Kein Anbieter"}
            </span>
            <details className="text-[10px] text-muted-foreground">
              <summary className="cursor-pointer">Technische Details</summary>
              <span>
                {activeProvider
                  ? `${activeProvider.model} · ${providerPreviewReason}`
                  : "Kein Modell eingerichtet"}
              </span>
            </details>
          </div>
          <div className="sport-ai-chat-actions flex items-center gap-2">
            <button
              type="button"
              onClick={startNewSession}
              className="sport-ai-header-action flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card"
              aria-label="Neuen Chat beginnen"
              title="Neuer Chat"
            >
              <Plus className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setSessionsOpen((v) => !v)}
              className="rounded-2xl border border-border bg-card px-3 py-2 text-xs font-semibold"
            >
              Verlauf
            </button>
            <button
              type="button"
              onClick={() => setSettingsOpen((v) => !v)}
              className="sport-ai-header-action flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card"
              aria-label="KI-Einstellungen"
              title="KI-Einstellungen"
            >
              <Settings2 className="h-5 w-5" aria-hidden="true" />
            </button>
            <details className="alo-mira-view-menu">
              <summary
                className="cursor-pointer rounded-2xl border border-border bg-card px-3 py-2 text-xs"
                aria-label="Mira-Ansicht wechseln"
              >
                •••
              </summary>
              <div className="mt-1 flex flex-col gap-1 rounded-xl border border-border bg-card p-2 text-xs">
                <button
                  type="button"
                  className="rounded-lg px-2 py-1 text-left hover:bg-secondary/40"
                  onClick={() => setSportAiView("chat")}
                >
                  Chat
                </button>
                <button
                  type="button"
                  className="rounded-lg px-2 py-1 text-left hover:bg-secondary/40"
                  onClick={() => setSportAiView("coach")}
                >
                  Coach
                </button>
                <button
                  type="button"
                  className="rounded-lg px-2 py-1 text-left hover:bg-secondary/40"
                  onClick={() => setSportAiView("history")}
                >
                  Verlauf-Ansicht
                </button>
              </div>
            </details>
          </div>
        </div>
      ) : (
        <SportPageIntro
          eyebrow="Mira"
          title="Dein KI-Begleiter"
          description="Chat, Ideen und optionale Trainingshilfe — mit Foto-Upload."
        />
      )}

      {sessionsOpen && (
        <div className="max-h-48 space-y-1 overflow-y-auto rounded-2xl border border-border bg-card/80 p-2">
          {sessions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => switchSession(s.id)}
              className={`block w-full rounded-xl px-3 py-2 text-left text-sm ${
                s.id === activeId ? "bg-primary/15 font-semibold" : "hover:bg-secondary/40"
              }`}
            >
              {s.title || "Chat"}
            </button>
          ))}
        </div>
      )}

      {settingsOpen && (
        <div className="rounded-2xl border border-border bg-card/80 p-3">
          <AiProviderSettings userId={userId} />
          <button type="button" className="mt-2 text-xs text-primary" onClick={() => setSettingsOpen(false)}>
            Schließen
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-2 text-xs">{error}</div>
      )}

      {sportAiView === "coach" && (
        <section className="rounded-[1.75rem] border border-border/70 bg-card/75 p-5">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="h-5 w-5" />
            <h2 className="text-lg font-bold">Coach</h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Frag Mira nach Trainingsideen, Technik-Tipps oder einem Plan für heute.
          </p>
          <button
            type="button"
            className="mt-4 rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            onClick={() => {
              setSportAiView("chat");
              void submit("Gib mir einen kurzen Trainingsvorschlag für heute.");
            }}
          >
            Vorschlag holen
          </button>
        </section>
      )}

      {sportAiView === "history" && (
        <section className="rounded-[1.75rem] border border-border/70 bg-card/75 p-5">
          <h2 className="text-lg font-bold">Verlauf</h2>
          <ul className="mt-3 space-y-2">
            {sessions.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className="w-full rounded-xl border border-border px-3 py-2 text-left text-sm hover:bg-secondary/30"
                  onClick={() => switchSession(s.id)}
                >
                  <div className="font-semibold">{s.title || "Chat"}</div>
                  <div className="text-[11px] text-muted-foreground">{s.updatedAt?.slice(0, 16)}</div>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {sportAiView === "chat" && (
        <>
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto">
            {messages.length === 0 && (
              <div className="rounded-[1.75rem] border border-border/70 bg-card/60 p-5">
                <p className="text-sm text-muted-foreground">
                  Hallo — tippe eine Frage oder hänge mit 📷 ein Foto an.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void submit(s)}
                      className="rounded-full border border-border bg-secondary/30 px-3 py-1.5 text-xs font-semibold"
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-[11px] text-muted-foreground">
                  {activeTitle} · Routing: {activeProvider?.label ?? "—"}
                </p>
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`rounded-2xl px-3 py-2 text-sm ${
                  m.role === "user" ? "ml-8 bg-primary/15" : "mr-8 bg-secondary/40"
                }`}
              >
                {m.content}
                {m.meta?.routingReason && (
                  <div className="mt-1 text-[10px] text-muted-foreground">{m.meta.routingReason}</div>
                )}
              </div>
            ))}
            {loading && <div className="text-xs text-muted-foreground">Mira denkt…</div>}
          </div>

          <div className="sticky bottom-16 z-10">
            {pendingImage && (
              <div className="mb-2 flex items-center gap-2 rounded-xl border border-border bg-secondary/30 px-2 py-1.5">
                <img src={pendingImage} alt="Anhang für Mira" className="h-14 w-14 rounded-lg object-cover" />
                <div className="min-w-0 flex-1 text-[11px] text-muted-foreground">
                  Foto bereit — wird mit der nächsten Nachricht gesendet.
                </div>
                <button
                  type="button"
                  className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-primary"
                  onClick={() => setPendingImage(null)}
                >
                  Entfernen
                </button>
              </div>
            )}
            <form
              className="sport-chat-composer flex items-end gap-2 rounded-[1.5rem] border border-border/70 bg-card/85 p-3 shadow-lg"
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <MiraPhotoAttach value={pendingImage} onChange={setPendingImage} disabled={loading} />
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void submit();
                  }
                }}
                placeholder="Deine Frage…"
                aria-label="Deine Frage an Mira"
                rows={1}
                className="min-h-12 min-w-0 flex-1 resize-none bg-transparent px-3 py-3 text-sm outline-none"
                style={{ maxHeight: 140 }}
                disabled={loading}
              />
              <button
                type="button"
                onClick={toggleVoice}
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border text-lg ${
                  listening ? "border-primary bg-primary/20 text-primary" : "border-border bg-secondary/40"
                }`}
                aria-label="Spracheingabe"
                aria-pressed={listening}
              >
                <Mic className="h-5 w-5" />
              </button>
              <button
                type="submit"
                aria-label="Nachricht senden"
                disabled={loading || (!input.trim() && !pendingImage)}
                className="flex h-12 items-center justify-center rounded-2xl bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-40"
              >
                <ArrowUp className="h-5 w-5" />
              </button>
            </form>
            <p className="mt-2 text-center text-[10px] text-muted-foreground">
              <Link to="/" className="underline">
                Zur Übersicht
              </Link>
            </p>
          </div>
        </>
      )}

      <BottomNav />
    </div>
  );
}
