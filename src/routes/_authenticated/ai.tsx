import { DesignView } from "@/components/DesignView";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { SportPageIntro, SportSectionLabel } from "@/components/SportPageIntro";
import { AiProviderSettings } from "@/components/AiProviderSettings";
import { buildAppContext, contextToSystemBlock } from "@/lib/ai-context";
import {
  applyPlanFeedback,
  getMostRecentPlanFeedback,
  parseAiResponse,
  type PlanFeedback,
} from "@/lib/ai-plan";
import type { AppContextPack } from "@/lib/ai-context";
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
type SportAiView = "coach" | "chat" | "history";
type SportAiHistoryFilter = "all" | "plans";

function describeContext(ctx: AppContextPack): string {
  const labels: Record<string, string> = {
    display_name: "Anzeigename",
    level: "Trainingsstufe",
    xp: "Erfahrungspunkte",
    current_streak: "aktuelle Trainingsserie",
    longest_streak: "längste Trainingsserie",
    best_count: "Liegestütz-Bestwert",
    personal_bests: "Übungsbestwerte",
    last_workout_date: "letzter Trainingstag",
    birth_year: "Geburtsjahr",
    height_cm: "Körpergröße",
    weight_kg: "Gewicht",
    sex: "Geschlecht",
    daily_goal: "Tagesziel",
  };
  const profileFields = Object.entries(ctx.profile ?? {})
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key]) => labels[key] ?? key);
  return [
    `Profil: ${profileFields.length ? profileFields.join(", ") : "keine Profilwerte"}`,
    `Datenabdeckung: ${ctx.dailyStatsDays} Tage mit Statistik-Einträgen; Wiederholungszahlen stammen nur aus gespeicherten Trainings, nicht aus diesen Tagesaggregaten.`,
    `Liegestütze diese Kalenderwoche ab Montag: ${ctx.weekReps == null ? "nicht verfügbar" : ctx.weeklyWorkoutCount === 0 ? "noch keine gespeicherten Workouts" : ctx.weekReps}`,
    `Trainings (${ctx.recentWorkouts.length}): ${ctx.recentWorkouts.map((workout) => `${workout.created_at.slice(0, 10)} ${workout.exercise_id ?? "Übung unbekannt"} × ${workout.count}`).join("; ") || "keine Einträge"}`,
    `Gesundheitsdaten (${ctx.health.length} Tage): ${ctx.health.map((day) => `${day.day}: ${day.steps ?? "Schritte unbekannt"} Schritte, ${day.sleep_min == null ? "Schlaf unbekannt" : `${(day.sleep_min / 60).toFixed(1)} h Schlaf`}, ${day.active_kcal ?? "Aktivitäts-kcal unbekannt"} aktive kcal`).join("; ") || "keine Einträge"}`,
    `Chat: ${ctx.chatRooms.length} Räume und ${ctx.recentChat.length} letzte eigene Nachrichten`,
  ].join("\n");
}

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
  const [toolsExpanded, setToolsExpanded] = useState(false);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [sessionQuery, setSessionQuery] = useState("");
  const [sessionFilter, setSessionFilter] = useState<SportAiHistoryFilter>("all");
  const [contextOpen, setContextOpen] = useState(false);
  const [persona, setPersona] = useState<AiPersona>(() => loadPersona());
  const [favs, setFavs] = useState<string[]>(() => loadFavPrompts());
  const [userId, setUserId] = useState<string | null>(null);
  const [contextHint, setContextHint] = useState<string | null>(null);
  const [appContext, setAppContext] = useState<AppContextPack | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [lastTask, setLastTask] = useState<AiTask | null>(null);
  const [sportAiView, setSportAiView] = useState<SportAiView>("coach");
  const [, refreshProviderStatus] = useState(0);
  const activeProvider = pickProvider(loadProviders(), lastTask ?? "general");
  const lastFeedback = getMostRecentPlanFeedback(messages);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  const activeTitle = useMemo(() => {
    const s = sessions.find((x) => x.id === activeId);
    if (s?.title) return s.title;
    const firstUser = messages.find((m) => m.role === "user");
    return firstUser ? firstUser.content.slice(0, 28) : "Neuer Chat";
  }, [sessions, activeId, messages]);

  const filteredSessions = useMemo(() => {
    const query = sessionQuery.trim().toLocaleLowerCase("de-DE");
    return sessions.filter((session) => {
      const hasPlan = session.messages.some((message) => message.plan);
      const lastMessage = session.messages[session.messages.length - 1]?.content ?? "";
      const matchesFilter = sessionFilter === "all" || hasPlan;
      const matchesQuery =
        !query || `${session.title} ${lastMessage}`.toLocaleLowerCase("de-DE").includes(query);
      return matchesFilter && matchesQuery;
    });
  }, [sessions, sessionQuery, sessionFilter]);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    });
  }, []);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    setContextLoading(true);
    void buildAppContext(userId)
      .then((ctx) => {
        if (active) setAppContext(ctx);
      })
      .catch(() => {
        if (active) setAppContext(null);
      })
      .finally(() => {
        if (active) setContextLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  // Persist active session
  useEffect(() => {
    const title = messages.find((m) => m.role === "user")?.content.slice(0, 40) || "Neuer Chat";
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
    setSportAiView("chat");
  };

  const startNewSession = () => {
    const id = newSessionId();
    setActiveId(id);
    setMessages([]);
    setSessionsOpen(false);
    setError(null);
    setSportAiView("chat");
  };

  const submit = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || loading) return;
    setError(null);
    const task: AiTask = classifyTask(text);
    setLastTask(task);
    const provider = pickProvider(loadProviders(), task);
    if (!provider) {
      setError("Kein aktiver KI-Anbieter. Öffne Zugangsdaten und hinterlege einen API-Schlüssel.");
      setSettingsOpen(true);
      return;
    }
    setSportAiView("chat");

    const nextMsgs: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(nextMsgs);
    setInput("");
    setLoading(true);
    try {
      let systemExtra = `${PERSONAS.find((p) => p.id === persona)?.system ?? ""}

Antworte auf Deutsch und erkläre Fachbegriffe wie „Routing“ einfach (Routing bedeutet: die App wählt passend zur Frage ein KI-Modell). Erfinde keine persönlichen Daten oder Trainingsergebnisse. Fehlt für eine sichere oder persönliche Trainingsempfehlung wichtiger Kontext, stelle zuerst eine konkrete Rückfrage. Bei einem konkreten einzelnen Trainingsvorschlag gib zusätzlich ein JSON-Objekt mit reply und einem vollständig ausgefüllten plan (title, exercise_id, sets, reps, rest_s, rationale) aus; wenn Kontext fehlt, lasse plan weg. Normale Antworten bleiben Text.${lastFeedback ? `\n\nRÜCKMELDUNG ZUM LETZTEN TRAININGSVORSCHLAG: ${lastFeedback}. Passe deine nächste Empfehlung ausdrücklich an diese Rückmeldung an und erwähne knapp, wie.` : ""}`;
      if (lastFeedback === "passt_nicht") {
        systemExtra +=
          "\nDer letzte Vorschlag passt nicht. Frage gezielt, ob Übung, verfügbare Zeit, Ausrüstung oder ein anderer Grund nicht passt; ändere nicht einfach nur Wiederholungszahlen. Gib erst nach Klärung einen neuen persönlichen Plan aus.";
      }
      if (userId) {
        const ctx = await buildAppContext(userId);
        setAppContext(ctx);
        setContextHint(describeContext(ctx));
        systemExtra = `${systemExtra}\n\n${contextToSystemBlock(ctx)}`;
      }
      const res = await send({
        data: {
          messages: nextMsgs.map(({ role, content }) => ({ role, content })),
          provider: toPayload(provider),
          task,
          systemExtra,
        },
      });
      const parsed = parseAiResponse(res.reply);
      const plan = parsed.plan ? applyPlanFeedback(parsed.plan, lastFeedback) : undefined;
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content:
            parsed.reply ||
            (plan ? "Hier ist dein unverbindlicher Trainingsvorschlag." : res.reply),
          ...(plan ? { plan } : {}),
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
        ? (
            window as unknown as {
              SpeechRecognition?: new () => SpeechRecognitionLike;
              webkitSpeechRecognition?: new () => SpeechRecognitionLike;
            }
          ).SpeechRecognition ||
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
    <>
      <DesignView variant="classic">
        <main className="classic-only mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-4 pt-5 pb-3">
          {/* Header */}
          <header className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/20 via-card/80 to-background p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <Link
                  to="/"
                  className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground"
                >
                  ← Übersicht
                </Link>
                <h1 className="mt-1 text-xl font-bold tracking-tight">Super-AI</h1>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{activeTitle}</p>
              </div>
              <div className="flex flex-wrap justify-end gap-1.5">
                <IconBtn label="Chats" onClick={() => setSessionsOpen((v) => !v)}>
                  💬
                </IconBtn>
                <IconBtn label="Werkzeuge" onClick={() => setToolsOpen((v) => !v)}>
                  ✦
                </IconBtn>
                <IconBtn label="Kontext" onClick={() => setContextOpen((v) => !v)}>
                  ⧉
                </IconBtn>
                <IconBtn label="Zugangsdaten" onClick={() => setSettingsOpen((v) => !v)}>
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
                  aria-pressed={persona === p.id}
                  className={`flex-1 rounded-xl border px-2 py-1.5 text-center transition ${
                    persona === p.id
                      ? "border-primary bg-primary/20 text-foreground"
                      : "border-border/60 bg-background/30 text-muted-foreground"
                  }`}
                >
                  <div className="text-[11px] font-semibold">{p.label}</div>
                  <div className="text-[9px] opacity-70">{p.hint}</div>
                  {persona === p.id && <span className="text-[9px]">Ausgewählt</span>}
                </button>
              ))}
            </div>

            {lastTask && (
              <p className="mt-2 text-[10px] text-muted-foreground">
                Frage eingeordnet: {lastTask}
              </p>
            )}
          </header>

          {/* Composer */}
          <div className="mt-2 rounded-2xl border border-border bg-card/70 p-2 shadow-sm backdrop-blur">
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
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-sm ${
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
                aria-label="Deine Frage an den KI-Coach"
                rows={1}
                className="min-w-0 flex-1 resize-none bg-transparent px-2 py-2.5 text-sm outline-none"
                style={{ maxHeight: 140 }}
                disabled={loading}
              />
              <button
                type="submit"
                aria-label="Nachricht senden"
                disabled={loading || !input.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground disabled:opacity-40"
              >
                ↑
              </button>
            </form>
          </div>

          <section
            className="mt-2 rounded-xl border border-border bg-card/50 px-3 py-2 text-[10px] text-muted-foreground"
            aria-label="Datenkontext vor dem Senden"
          >
            <div className="font-semibold text-foreground">Daten, die beim Senden mitgehen</div>
            <p className="mt-0.5 whitespace-pre-line">
              {contextLoading
                ? "App-Daten werden geladen …"
                : appContext
                  ? describeContext(appContext)
                  : userId
                    ? "App-Kontext gerade nicht verfügbar; es werden keine App-Daten ergänzt."
                    : "Noch nicht angemeldet oder kein App-Kontext geladen; es werden keine App-Daten ergänzt."}
            </p>
            <p className="mt-1">
              Dazu kommen deine Eingabe und dieser Chatverlauf. Fehlende Werte bleiben unbekannt; es
              werden keine Trainings- oder Gesundheitswerte erfunden.
            </p>
            <p className="mt-1">
              Routing heißt: Die App wählt anhand deiner Frage einen passenden KI-Anbieter und ein
              Modell.
            </p>
          </section>

          {/* Sessions drawer */}
          {sessionsOpen && (
            <section className="mt-3 rounded-2xl border border-border bg-card/80 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  Gespräche
                </span>
                <button
                  type="button"
                  onClick={startNewSession}
                  className="text-xs font-semibold text-primary"
                >
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
                        s.id === activeId
                          ? "bg-primary/15 text-foreground"
                          : "hover:bg-secondary/50"
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
                KI-Anbieter und API-Zugangsdaten
              </div>
              <AiProviderSettings />
            </section>
          )}

          {contextOpen && (
            <section className="mt-3 rounded-2xl border border-border bg-card/80 p-3 text-xs text-muted-foreground">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em]">
                App-Kontext
              </div>
              Beim Senden werden die oben aufgelisteten geladenen Daten angehängt. Persona:{" "}
              <strong className="text-foreground">{persona}</strong>.
              {contextHint && (
                <p className="mt-1 text-foreground">Letzte Datenabfrage: {contextHint}</p>
              )}
            </section>
          )}

          {/* Suggestions */}
          {toolsOpen && (
            <section className="mt-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  Vorschläge · {toolsExpanded ? "10" : "3"} von 10
                </div>
                <button
                  type="button"
                  onClick={() => setToolsExpanded((expanded) => !expanded)}
                  className="text-[10px] font-medium text-primary"
                >
                  {toolsExpanded ? "Weniger Vorschläge" : "Mehr Vorschläge"}
                </button>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {(toolsExpanded ? SUPER_TOOLS : SUPER_TOOLS.slice(0, 3)).map((t) => (
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
            className="mt-3 flex-1 space-y-3 overflow-y-auto rounded-3xl border border-border bg-card/30 p-3 backdrop-blur"
          >
            {messages.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-3xl shadow-inner">
                  ⚡
                </div>
                <p className="text-sm font-semibold">Dein Multi-KI Coach</p>
                <p className="max-w-[260px] text-xs text-muted-foreground">
                  Schreib zuerst, was du wissen möchtest. „Routing“ heißt nur: Die App wählt passend
                  dazu einen KI-Anbieter und ein Modell.
                </p>
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
              >
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[88%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5 text-sm text-primary-foreground shadow-sm"
                      : "max-w-[92%] rounded-2xl rounded-bl-md border border-border/80 bg-background/70 px-3.5 py-2.5 text-sm leading-relaxed shadow-sm"
                  }
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>
                  {m.role === "assistant" && m.plan && (
                    <section
                      className="mt-3 rounded-xl border border-primary/30 bg-primary/5 p-3"
                      aria-label="Trainingsvorschau"
                    >
                      <div className="text-xs font-semibold">Vorschau: {m.plan.title}</div>
                      <div className="mt-1 text-xs text-foreground">
                        {m.plan.sets} Sätze × {m.plan.reps} Wiederholungen · {m.plan.rest_s} s Pause
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">{m.plan.rationale}</p>
                      <p className="mt-2 text-[10px] text-muted-foreground">
                        Nur ein Vorschlag – noch nicht als Training absolviert. Die Einheit startet
                        erst, wenn du sie dort selbst startest.
                      </p>
                      <Link
                        to="/workout/$exerciseId"
                        params={{ exerciseId: m.plan.exercise_id }}
                        search={
                          {
                            mode: "manual",
                            sets: m.plan.sets,
                            reps: m.plan.reps,
                            rest_s: m.plan.rest_s,
                            title: m.plan.title,
                          } as never
                        }
                        className="mt-2 inline-flex rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                      >
                        Trainingsvorschau öffnen
                      </Link>
                      <div
                        className="mt-2 flex flex-wrap gap-1.5"
                        aria-label="Trainingsvorschlag bewerten"
                      >
                        {(["zu_schwer", "zu_leicht", "passt_nicht", "passt"] as const).map(
                          (rating) => (
                            <button
                              key={rating}
                              type="button"
                              onClick={() => {
                                setMessages((current) =>
                                  current.map((message, messageIndex) =>
                                    messageIndex === i ? { ...message, feedback: rating } : message,
                                  ),
                                );
                                setContextHint(
                                  `Danke — „${rating === "zu_schwer" ? "zu schwer" : rating === "zu_leicht" ? "zu leicht" : rating === "passt_nicht" ? "passt nicht" : "passt"}“ beeinflusst den nächsten Trainingsvorschlag.`,
                                );
                              }}
                              aria-pressed={m.feedback === rating}
                              className={`rounded-full border px-2 py-1 text-[10px] ${m.feedback === rating ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground"}`}
                            >
                              {rating === "zu_schwer"
                                ? "Zu schwer"
                                : rating === "zu_leicht"
                                  ? "Zu leicht"
                                  : rating === "passt_nicht"
                                    ? "Passt nicht"
                                    : "Passt"}
                            </button>
                          ),
                        )}
                      </div>
                      {m.feedback && (
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          Bewertung:{" "}
                          {m.feedback === "zu_schwer"
                            ? "Zu schwer"
                            : m.feedback === "zu_leicht"
                              ? "Zu leicht"
                              : m.feedback === "passt_nicht"
                                ? "Passt nicht"
                                : "Passt"}
                          . Diese Rückmeldung ist mit dem Vorschlag gespeichert und wird bei der
                          nächsten Empfehlung berücksichtigt.
                        </p>
                      )}
                    </section>
                  )}
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

          <BottomNav />
        </main>
      </DesignView>
      <DesignView variant="sport">
        <main
          className={`sport-only sport-ai-page mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col gap-5 px-5 py-6 pb-28 sm:px-8 ${sportAiView === "chat" ? "sport-ai-chat-mode" : ""}`}
        >
          {sportAiView === "chat" ? (
            <header className="sport-ai-compact-heading">
              <p className="sport-kicker">KI-COACH · CHAT</p>
              <h1>Coach-Chat</h1>
            </header>
          ) : (
            <SportPageIntro
              eyebrow="DEIN KI-COACH"
              title="Super-AI"
              description="Trainingsplanung, Fortschritt und Fragen – in einem klaren Coach-Bereich."
            />
          )}
          <section className="sport-ai-hub" aria-label="KI-Coach-Navigation">
            <div className="sport-ai-provider-status">
              <div>
                <span className="sport-ai-status-dot" aria-hidden="true" />
                <span className="font-semibold">{activeProvider?.label ?? "Kein Anbieter"}</span>
                <span className="text-muted-foreground">
                  {activeProvider ? "bereit" : "Zugang fehlt"}
                </span>
              </div>
              <button type="button" onClick={() => setSettingsOpen((v) => !v)}>
                {settingsOpen ? "Einstellungen schließen" : "KI-Einstellungen"}
              </button>
            </div>
            <nav className="sport-ai-tabs" aria-label="KI-Coach-Bereiche">
              {(["coach", "chat", "history"] as const).map((view) => (
                <button
                  key={view}
                  type="button"
                  aria-pressed={sportAiView === view}
                  className={sportAiView === view ? "is-active" : ""}
                  aria-label={
                    view === "history" && sessions.length > 0
                      ? `Verlauf, ${sessions.length} Gespräche`
                      : view === "chat"
                        ? "Coach-Chat"
                        : view === "coach"
                          ? "Coach"
                          : "Verlauf"
                  }
                  onClick={() => {
                    setSportAiView(view);
                    setSessionsOpen(false);
                  }}
                >
                  <span>
                    {view === "chat" ? "Coach-Chat" : view === "history" ? "Verlauf" : "Coach"}
                  </span>
                  {view === "history" && sessions.length > 0 && (
                    <span className="sport-ai-tab-count" aria-hidden="true">
                      {sessions.length}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </section>
          {settingsOpen && (
            <section className="sport-ai-settings-card rounded-[1.5rem] border border-border/70 bg-card/75 p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold">KI-Anbieter und Zugangsdaten</h2>
                <button
                  type="button"
                  className="text-sm font-semibold text-primary"
                  onClick={() => setSettingsOpen(false)}
                >
                  Schließen
                </button>
              </div>
              <AiProviderSettings
                onSaved={() => refreshProviderStatus((revision) => revision + 1)}
              />
            </section>
          )}
          {sportAiView === "coach" && (
            <section className="sport-ai-home" aria-labelledby="sport-ai-home-title">
              <div className="sport-ai-home-heading">
                <div>
                  <p className="sport-kicker">Dein nächster Schritt</p>
                  <h2 id="sport-ai-home-title">Wobei soll ich dir helfen?</h2>
                  <p>Dein Coach nutzt verfügbare Trainingsdaten. Fehlendes bleibt unbekannt.</p>
                </div>
                <details className="sport-ai-persona-details">
                  <summary>
                    Coach-Stil: {PERSONAS.find((p) => p.id === persona)?.label ?? "Coach"}
                  </summary>
                  <div className="sport-ai-persona-options">
                    {PERSONAS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => onPersona(p.id)}
                        aria-pressed={persona === p.id}
                      >
                        <span className="block font-semibold">{p.label}</span>
                        <span className="text-xs text-muted-foreground">{p.hint}</span>
                      </button>
                    ))}
                  </div>
                </details>
              </div>
              <div className="sport-ai-primary-actions">
                <button
                  type="button"
                  onClick={() =>
                    void submit(SUPER_TOOLS.find((tool) => tool.id === "week_plan")?.prompt)
                  }
                  disabled={loading}
                  className="sport-ai-primary-card"
                >
                  <span className="sport-ai-action-icon" aria-hidden="true">
                    📅
                  </span>
                  <span>
                    <strong>Trainingsplan erstellen</strong>
                    <small>Eine passende Woche aus deinen verfügbaren Daten</small>
                  </span>
                  <span aria-hidden="true">→</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSportAiView("chat")}
                  className="sport-ai-secondary-card"
                >
                  <span className="sport-ai-action-icon" aria-hidden="true">
                    💬
                  </span>
                  <span>
                    <strong>Coach fragen</strong>
                    <small>Stell eine freie Frage zu Training oder Erholung</small>
                  </span>
                  <span aria-hidden="true">→</span>
                </button>
              </div>
              <div className="sport-ai-quick-starts">
                <div>
                  <h3>Schnelle Einstiege</h3>
                  <p>Drei häufige Fragen, ein Tipp genügt.</p>
                </div>
                <div className="sport-ai-quick-grid">
                  {SUPER_TOOLS.filter((tool) =>
                    ["week_review", "form_check", "recovery"].includes(tool.id),
                  ).map((tool) => (
                    <button
                      key={tool.id}
                      type="button"
                      onClick={() => void submit(tool.prompt)}
                      disabled={loading}
                    >
                      <span aria-hidden="true">{tool.icon}</span>
                      <span>
                        <strong>{tool.label}</strong>
                        <small>{tool.description}</small>
                      </span>
                    </button>
                  ))}
                </div>
                <details className="sport-ai-more-tools">
                  <summary>Weitere Coach-Aufgaben · {SUPER_TOOLS.length - 4}</summary>
                  <div className="sport-ai-quick-grid">
                    {SUPER_TOOLS.filter(
                      (tool) =>
                        !["week_plan", "week_review", "form_check", "recovery"].includes(tool.id),
                    ).map((tool) => (
                      <button
                        key={tool.id}
                        type="button"
                        onClick={() => void submit(tool.prompt)}
                        disabled={loading}
                      >
                        <span aria-hidden="true">{tool.icon}</span>
                        <span>
                          <strong>{tool.label}</strong>
                          <small>{tool.description}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                </details>
                {messages.length > 0 && (
                  <button
                    type="button"
                    className="sport-ai-resume"
                    onClick={() => setSportAiView("chat")}
                  >
                    Letzten Chat fortsetzen · {activeTitle} <span aria-hidden="true">→</span>
                  </button>
                )}
              </div>
            </section>
          )}
          {sportAiView === "history" && (
            <section className="sport-ai-history rounded-[1.5rem] border border-border/70 bg-card/75 p-5">
              <div className="sport-ai-history-head">
                <div>
                  <h2>Deine Chats</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Zuletzt auf diesem Gerät gespeichert.
                  </p>
                </div>
                <button type="button" onClick={startNewSession} className="sport-ai-new-chat">
                  <span aria-hidden="true">＋</span> Neuer Chat
                </button>
              </div>
              <label className="sport-ai-session-search">
                <span aria-hidden="true">⌕</span>
                <input
                  type="search"
                  value={sessionQuery}
                  onChange={(event) => setSessionQuery(event.target.value)}
                  placeholder="Chats durchsuchen"
                  aria-label="Gespeicherte Chats durchsuchen"
                />
              </label>
              <div className="sport-ai-session-filters" role="group" aria-label="Chats filtern">
                {(
                  [
                    ["all", `Alle · ${sessions.length}`],
                    [
                      "plans",
                      `Mit Trainingsplan · ${sessions.filter((session) => session.messages.some((message) => message.plan)).length}`,
                    ],
                  ] as const
                ).map(([filter, label]) => (
                  <button
                    key={filter}
                    type="button"
                    aria-pressed={sessionFilter === filter}
                    className={sessionFilter === filter ? "is-active" : ""}
                    onClick={() => setSessionFilter(filter)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="sport-ai-session-list">
                {filteredSessions.map((session) => {
                  const latest = session.messages[session.messages.length - 1];
                  const preview = latest
                    ? `${latest.role === "user" ? "Du: " : "Coach: "}${latest.content}`
                    : "Noch keine Nachrichten";
                  return (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() => switchSession(session.id)}
                      className={`sport-ai-session-row ${session.id === activeId ? "is-active" : ""}`}
                    >
                      <span className="sport-ai-session-avatar" aria-hidden="true">
                        {(session.title || "C").slice(0, 1).toLocaleUpperCase("de-DE")}
                      </span>
                      <span className="sport-ai-session-copy">
                        <strong>{session.title || "Neuer Chat"}</strong>
                        <span>{preview}</span>
                      </span>
                      <time dateTime={session.updatedAt}>
                        {new Date(session.updatedAt).toLocaleDateString("de-DE", {
                          day: "2-digit",
                          month: "2-digit",
                        })}
                      </time>
                    </button>
                  );
                })}
                {sessions.length === 0 && (
                  <p className="sport-ai-history-empty">Noch keine Gespräche gespeichert.</p>
                )}
                {sessions.length > 0 && filteredSessions.length === 0 && (
                  <p className="sport-ai-history-empty">Keine Chats für diese Suche gefunden.</p>
                )}
              </div>
            </section>
          )}
          {sportAiView === "chat" && (
            <div className="sport-ai-chat-grid">
              <div className="sport-ai-chat-main flex min-w-0 flex-col gap-5">
                <section className="sport-ai-chat-toolbar rounded-2xl border border-border/70 bg-card/70 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-primary">
                        {PERSONAS.find((p) => p.id === persona)?.label ?? "Coach"}
                        {lastTask && <span className="text-muted-foreground"> · {lastTask}</span>}
                      </p>
                      <h2 className="truncate text-sm font-bold">{activeTitle}</h2>
                    </div>
                    <details className="sport-ai-persona-details">
                      <summary>Coach-Stil</summary>
                      <div className="sport-ai-persona-options">
                        {PERSONAS.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => onPersona(p.id)}
                            aria-pressed={persona === p.id}
                          >
                            <span className="block font-semibold">{p.label}</span>
                            <span className="text-xs text-muted-foreground">{p.hint}</span>
                          </button>
                        ))}
                      </div>
                    </details>
                  </div>
                  <button
                    type="button"
                    className="mt-2 text-xs font-semibold text-muted-foreground"
                    onClick={() => setContextOpen((v) => !v)}
                  >
                    {contextOpen ? "Kontextdetails ausblenden" : "Welche App-Daten gehen mit?"}
                  </button>
                </section>
                {contextOpen && (
                  <section className="rounded-[1.5rem] border border-border/70 bg-card/75 p-5 text-sm">
                    <h3 className="font-bold">App-Kontext & Datenschutz</h3>
                    <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
                      {contextLoading
                        ? "App-Daten werden geladen …"
                        : appContext
                          ? describeContext(appContext)
                          : userId
                            ? "App-Kontext gerade nicht verfügbar; es werden keine App-Daten ergänzt."
                            : "Noch nicht angemeldet oder kein App-Kontext geladen; es werden keine App-Daten ergänzt."}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Deine Eingabe und dieser Chatverlauf werden ergänzt. Fehlende Werte bleiben
                      unbekannt. Routing heißt: Die App wählt passend zur Frage ein Modell.
                    </p>
                  </section>
                )}
                <div className="flex flex-wrap gap-2">
                  <SmallAction onClick={regenerate} disabled={loading || messages.length === 0}>
                    Neu generieren
                  </SmallAction>
                  <SmallAction onClick={exportChat} disabled={messages.length === 0}>
                    Chat exportieren
                  </SmallAction>
                  <SmallAction
                    onClick={() => {
                      setMessages([]);
                      setError(null);
                    }}
                  >
                    Verlauf leeren
                  </SmallAction>
                </div>
                <SportSectionLabel number="01">Gesprächsverlauf</SportSectionLabel>
                <div
                  ref={scrollRef}
                  className="sport-chat-stage flex min-h-[38vh] flex-1 flex-col gap-4 overflow-y-auto rounded-[2rem] border border-border/70 bg-card/55 p-4 shadow-sm sm:p-6"
                >
                  {messages.length === 0 && (
                    <div className="mx-auto my-auto max-w-lg py-8 text-center">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-primary/10 text-3xl">
                        ⚡
                      </div>
                      <h3 className="mt-4 text-xl font-bold">Womit kann ich dich unterstützen?</h3>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Frag nach Training, Erholung oder deinen gespeicherten Werten.
                      </p>
                    </div>
                  )}
                  {messages.map((m, i) => (
                    <div
                      key={i}
                      className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <article
                        className={`sport-ai-bubble max-w-[90%] rounded-[1.5rem] px-5 py-4 text-sm leading-relaxed shadow-sm ${m.role === "user" ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md border border-border/70 bg-background/80"}`}
                      >
                        <p className="whitespace-pre-wrap">{m.content}</p>
                        {m.role === "assistant" && m.plan && (
                          <section className="mt-4 rounded-2xl border border-primary/30 bg-primary/5 p-4">
                            <div className="text-xs font-bold uppercase tracking-wider text-primary">
                              Trainingsvorschau
                            </div>
                            <h4 className="mt-1 font-bold">{m.plan.title}</h4>
                            <p className="mt-2 text-sm">
                              {m.plan.sets} Sätze × {m.plan.reps} Wiederholungen · {m.plan.rest_s} s
                              Pause
                            </p>
                            <p className="mt-2 text-xs text-muted-foreground">{m.plan.rationale}</p>
                            <p className="mt-2 text-[11px] text-muted-foreground">
                              Nur Vorschlag – startet nicht automatisch als Training.
                            </p>
                            <Link
                              to="/workout/$exerciseId"
                              params={{ exerciseId: m.plan.exercise_id }}
                              search={
                                {
                                  mode: "manual",
                                  sets: m.plan.sets,
                                  reps: m.plan.reps,
                                  rest_s: m.plan.rest_s,
                                  title: m.plan.title,
                                } as never
                              }
                              className="mt-3 inline-flex rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
                            >
                              Trainingsvorschau öffnen →
                            </Link>
                            <div
                              className="mt-3 flex flex-wrap gap-2"
                              aria-label="Trainingsvorschlag bewerten"
                            >
                              {(["zu_schwer", "zu_leicht", "passt_nicht", "passt"] as const).map(
                                (rating) => (
                                  <button
                                    key={rating}
                                    type="button"
                                    onClick={() => {
                                      setMessages((current) =>
                                        current.map((message, index) =>
                                          index === i ? { ...message, feedback: rating } : message,
                                        ),
                                      );
                                      setContextHint(
                                        `Danke — „${rating === "zu_schwer" ? "zu schwer" : rating === "zu_leicht" ? "zu leicht" : rating === "passt_nicht" ? "passt nicht" : "passt"}“ beeinflusst den nächsten Trainingsvorschlag.`,
                                      );
                                    }}
                                    aria-pressed={m.feedback === rating}
                                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${m.feedback === rating ? "border-primary bg-primary/15" : "border-border text-muted-foreground"}`}
                                  >
                                    {rating === "zu_schwer"
                                      ? "Zu schwer"
                                      : rating === "zu_leicht"
                                        ? "Zu leicht"
                                        : rating === "passt_nicht"
                                          ? "Passt nicht"
                                          : "Passt"}
                                  </button>
                                ),
                              )}
                            </div>
                          </section>
                        )}
                        {m.role === "assistant" && (
                          <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border/50 pt-2 text-[10px]">
                            {m.meta && (
                              <span className="text-muted-foreground">
                                {m.meta.provider} · {m.meta.model} · {m.meta.task}
                              </span>
                            )}
                            <button
                              type="button"
                              className="font-semibold text-primary"
                              onClick={() => void copyText(m.content)}
                            >
                              Kopieren
                            </button>
                            <button
                              type="button"
                              className="font-semibold text-muted-foreground"
                              onClick={() => setFavs(toggleFavPrompt(m.content.slice(0, 120)))}
                            >
                              ★ Merken
                            </button>
                          </div>
                        )}
                      </article>
                    </div>
                  ))}
                  {loading && (
                    <div className="self-start rounded-2xl border border-border/70 bg-background/80 px-4 py-3 text-sm text-muted-foreground">
                      Super-AI denkt…
                    </div>
                  )}
                </div>
                {error && (
                  <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                  </div>
                )}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void submit();
                  }}
                  className="sport-chat-composer flex items-end gap-2 rounded-[1.5rem] border border-border/70 bg-card/85 p-3 shadow-lg"
                >
                  <button
                    type="button"
                    onClick={toggleVoice}
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border text-lg ${listening ? "border-primary bg-primary/20 text-primary" : "border-border bg-secondary/40"}`}
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
                    placeholder="Deine Frage an Super-AI…"
                    aria-label="Deine Frage an den KI-Coach"
                    rows={1}
                    className="min-h-12 min-w-0 flex-1 resize-none bg-transparent px-3 py-3 text-sm outline-none"
                    style={{ maxHeight: 140 }}
                    disabled={loading}
                  />
                  <button
                    type="submit"
                    aria-label="Nachricht senden"
                    disabled={loading || !input.trim()}
                    className="flex h-12 items-center justify-center rounded-2xl bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-40"
                  >
                    Senden ↑
                  </button>
                </form>
              </div>
              <aside className="sport-ai-chat-aside flex flex-col gap-4 lg:sticky lg:top-5">
                <section className="rounded-[1.75rem] border border-border/70 bg-card/75 p-5">
                  <div className="text-xs font-bold uppercase tracking-[0.17em] text-primary">
                    Dein Workspace
                  </div>
                  <h2 className="mt-2 text-lg font-bold">Schnellzugriff</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Wähle ein Thema, um direkt zu starten.
                  </p>
                  <button
                    type="button"
                    onClick={() => setToolsOpen((v) => !v)}
                    className="mt-3 text-xs font-semibold text-primary"
                  >
                    {toolsOpen ? "Werkzeuge ausblenden" : "Werkzeuge anzeigen"}
                  </button>
                  {toolsOpen && (
                    <>
                      <button
                        type="button"
                        onClick={() => setToolsExpanded((expanded) => !expanded)}
                        className="mt-3 block text-xs text-muted-foreground"
                      >
                        {toolsExpanded ? "Weniger Vorschläge" : "Alle 10 Vorschläge ansehen"}
                      </button>
                      <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-1">
                        {(toolsExpanded ? SUPER_TOOLS : SUPER_TOOLS.slice(0, 3)).map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            disabled={loading}
                            onClick={() => void submit(t.prompt)}
                            className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/50 p-3 text-left transition hover:border-primary/40 disabled:opacity-50"
                            title={t.description}
                          >
                            <span className="text-xl">{t.icon}</span>
                            <span>
                              <span className="block text-xs font-bold">{t.label}</span>
                              <span className="mt-1 block text-[10px] text-muted-foreground">
                                Frage starten
                              </span>
                            </span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </section>
                {favs.length > 0 && (
                  <section className="rounded-[1.5rem] border border-border/70 bg-card/75 p-5">
                    <h3 className="font-bold">Favoriten</h3>
                    <div className="mt-3 flex flex-col gap-2">
                      {favs.map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => void submit(f)}
                          className="rounded-xl border border-border/70 p-3 text-left text-xs"
                        >
                          ★ {f}
                        </button>
                      ))}
                    </div>
                  </section>
                )}
                <section className="rounded-[1.5rem] border border-border/70 bg-card/60 p-5">
                  <h3 className="font-bold">Kontext beim Senden</h3>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {contextLoading
                      ? "App-Daten werden geladen …"
                      : appContext
                        ? `${appContext.recentWorkouts.length} letzte Trainings · ${appContext.health.length} Tage Gesundheitsdaten · ${appContext.chatRooms.length} Chat-Räume`
                        : "Keine App-Daten verfügbar. Fehlende Werte werden nicht erfunden."}
                  </p>
                  <button
                    type="button"
                    onClick={() => setContextOpen((v) => !v)}
                    className="mt-3 text-xs font-semibold text-primary"
                  >
                    {contextOpen ? "Kontext schließen" : "Details anzeigen →"}
                  </button>
                </section>
              </aside>
            </div>
          )}
          <BottomNav />
        </main>
      </DesignView>
    </>
  );
}

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult:
    ((ev: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void) | null;
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
      className="flex h-8 w-8 items-center justify-center rounded-xl border border-border/70 bg-background/50 text-sm backdrop-blur transition active:scale-95"
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
      className="rounded-lg border border-border px-2 py-0.5 text-[10px] text-muted-foreground disabled:opacity-40"
    >
      {children}
    </button>
  );
}
