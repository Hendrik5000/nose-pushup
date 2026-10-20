import { MiraRunwareResult } from "@/components/alo/MiraRunwareResult";
import { MiraSources } from "@/components/alo/MiraSources";
import {
  Sparkles,
  Mic,
  ArrowUp,
  Plus,
  Settings2,
  CalendarDays,
  Activity,
  Moon,
  ArrowUpRight,
} from "lucide-react";
import { ALO_EVENT, ALO_REMOTE_EVENT, getMiraGrants, putAlo, removeAlo } from "@/lib/alo-store";
import { MiraContextControls } from "@/components/alo/MiraContextControls";
import { MiraRunwareTools } from "@/components/alo/MiraRunwareTools";
import { ContentActions } from "@/components/alo/ContentActions";
import { DesignView } from "@/components/DesignView";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { SportPageIntro, SportSectionLabel } from "@/components/SportPageIntro";
import { AiProviderSettings } from "@/components/AiProviderSettings";
import { buildAppContext, contextToSystemBlock } from "@/lib/ai-context";
import { miraDraftId, readMiraDraft, rememberMiraSession } from "@/lib/mira-handoff";
import {
  applyPlanFeedback,
  getMostRecentPlanFeedback,
  parseAiResponse,
  type PlanFeedback,
} from "@/lib/ai-plan";
import type { AppContextPack } from "@/lib/ai-context";
import {
  classifyTask,
  describeProviderSelection,
  loadProviders,
  providerLabel,
  selectProvider,
  toPayload,
  type AiTask,
} from "@/lib/ai-providers";
import { superAiChat } from "@/lib/super-ai.functions";
import { MiraPhotoAttach } from "@/components/MiraPhotoAttach";
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
      { title: "Mira — Alo" },
      {
        name: "description",
        content:
          "Mira ist deine vielseitige KI für Alltag, Wissen, Schreiben und Ideen. Trainings- oder Chat-Kontext kannst du bei Bedarf freigeben.",
      },
    ],
  }),
  component: SuperAiPage,
});

type StoredMsg = AiSession["messages"][number];
type Msg = Omit<StoredMsg, "meta"> & {
  meta?: NonNullable<StoredMsg["meta"]> & { routingReason?: string };
};
type SportAiView = "coach" | "chat" | "history";
type SportAiHistoryFilter = "all" | "plans";
function getMiraContextPreference() {
  const grants = getMiraGrants();
  return grants.training || grants.rooms.length > 0;
}

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
    `Datenabdeckung: ${ctx.dailyStatsDays} Tage mit Statistik-Einträgen`,
    `Trainings (${ctx.recentWorkouts.length})`,
    `Gesundheitsdaten (${ctx.health.length} Tage)`,
    `Chat: ${ctx.chatRooms.length} Räume`,
  ].join("\n");
}

export function SuperAiPage() {
  const send = useServerFn(superAiChat);
  const [sessions, setSessions] = useState<AiSession[]>(() => loadSessions());
  const [activeId, setActiveId] = useState<string>(() => loadSessions()[0]?.id ?? newSessionId());
  const [messages, setMessages] = useState<Msg[]>(() => loadSessions()[0]?.messages ?? []);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [persona] = useState<AiPersona>(() => loadPersona());
  const [userId, setUserId] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [lastTask, setLastTask] = useState<AiTask | null>(null);
  const [sportAiView, setSportAiView] = useState<SportAiView>("chat");
  const generationRef = useRef(0);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    });
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

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
      let systemExtra = `Du bist Mira, die vielseitige allgemeine KI von Alo. Antworte auf Deutsch. ${PERSONAS.find((p) => p.id === persona)?.system ?? ""}`;
      if (imageDataUrl) {
        systemExtra += "\nDer Nutzer hat ein Foto angehängt. Beschreibe relevante Inhalte und hilf konkret.";
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
    const SR = (window as unknown as { webkitSpeechRecognition?: new () => { lang: string; continuous: boolean; interimResults: boolean; onresult: ((e: { results: { [key: number]: { [key: number]: { transcript: string } } } }) => void) | null; onerror: (() => void) | null; onend: (() => void) | null; start: () => void; stop: () => void } }).webkitSpeechRecognition;
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

  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-3xl flex-col gap-3 p-4">
      <div className="text-lg font-bold">Mira</div>
      {error && <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-2 text-xs">{error}</div>}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-border p-3">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground">Hallo — du kannst Text und Fotos senden.</p>
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
      {pendingImage && (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary/30 px-2 py-1.5">
          <img src={pendingImage} alt="Anhang" className="h-14 w-14 rounded-lg object-cover" />
          <button type="button" className="text-xs font-semibold text-primary" onClick={() => setPendingImage(null)}>
            Entfernen
          </button>
        </div>
      )}
      <form
        className="flex items-end gap-2 rounded-2xl border border-border p-2"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <MiraPhotoAttach value={pendingImage} onChange={setPendingImage} disabled={loading} />
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Deine Frage…"
          rows={1}
          className="min-h-12 min-w-0 flex-1 resize-none bg-transparent px-2 py-3 text-sm outline-none"
          disabled={loading}
        />
        <button
          type="button"
          onClick={toggleVoice}
          className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border"
          aria-label="Spracheingabe"
        >
          <Mic className="h-5 w-5" />
        </button>
        <button
          type="submit"
          disabled={loading || (!input.trim() && !pendingImage)}
          className="flex h-12 items-center justify-center rounded-2xl bg-primary px-4 text-primary-foreground disabled:opacity-40"
          aria-label="Senden"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      </form>
      {settingsOpen && (
        <div className="rounded-2xl border border-border p-3">
          <AiProviderSettings userId={userId} />
          <button type="button" className="mt-2 text-xs text-primary" onClick={() => setSettingsOpen(false)}>
            Schließen
          </button>
        </div>
      )}
      {!settingsOpen && (
        <button type="button" className="text-xs text-muted-foreground" onClick={() => setSettingsOpen(true)}>
          KI-Anbieter / API-Keys
        </button>
      )}
    </div>
  );
}
