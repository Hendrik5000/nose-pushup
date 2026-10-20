import { Mic, ArrowUp } from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { AiProviderSettings } from "@/components/AiProviderSettings";
import { MiraPhotoAttach } from "@/components/MiraPhotoAttach";
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
import { loadPersona, PERSONAS, type AiPersona } from "@/lib/super-ai-tools";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/ai")({
  head: () => ({
    meta: [
      { title: "Mira — Alo" },
      {
        name: "description",
        content:
          "Mira ist deine vielseitige KI für Alltag, Wissen, Schreiben und Ideen. Du kannst auch Fotos mitschicken.",
      },
    ],
  }),
  component: SuperAiPage,
});

type Msg = {
  role: "user" | "assistant";
  content: string;
  meta?: { provider?: string; model?: string; task?: string; routingReason?: string };
};

export function SuperAiPage() {
  const send = useServerFn(superAiChat);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [persona] = useState<AiPersona>(() => loadPersona());
  const [userId, setUserId] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
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

  const submit = async () => {
    const text = input.trim();
    const imageDataUrl = pendingImage;
    if ((!text && !imageDataUrl) || loading) return;
    setError(null);
    const task: AiTask = classifyTask(text || "Was siehst du auf dem Foto?", {
      hasImage: Boolean(imageDataUrl),
    });
    const selection = selectProvider(loadProviders(userId), task);
    const provider = selection.provider;
    if (!provider) {
      setError("Kein aktiver KI-Anbieter. Öffne Zugangsdaten und hinterlege einen API-Schlüssel.");
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
      let systemExtra = `Du bist Mira, die vielseitige allgemeine KI von Alo. Antworte auf Deutsch. ${PERSONAS.find((p) => p.id === persona)?.system ?? ""}`;
      if (imageDataUrl) {
        systemExtra +=
          "\nDer Nutzer hat ein Foto angehängt. Beschreibe relevante Inhalte und hilf konkret. Erfinde keine nicht sichtbaren Details.";
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
      onresult: ((e: { results: { [key: number]: { [key: number]: { transcript: string } } } }) => void) | null;
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

  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-3xl flex-col gap-3 p-4">
      <div className="text-lg font-bold">Mira</div>
      {error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-2 text-xs">{error}</div>
      )}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-border p-3">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Hallo — tippe eine Frage oder hänge mit 📷 ein Foto an.
          </p>
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
          <button
            type="button"
            className="text-xs font-semibold text-primary"
            onClick={() => setPendingImage(null)}
          >
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
      {settingsOpen ? (
        <div className="rounded-2xl border border-border p-3">
          <AiProviderSettings userId={userId} />
          <button type="button" className="mt-2 text-xs text-primary" onClick={() => setSettingsOpen(false)}>
            Schließen
          </button>
        </div>
      ) : (
        <button type="button" className="text-xs text-muted-foreground" onClick={() => setSettingsOpen(true)}>
          KI-Anbieter / API-Keys
        </button>
      )}
    </div>
  );
}
