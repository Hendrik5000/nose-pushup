import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { MiraAnswerText } from "@/components/mira/MiraAnswerText";
import { MiraSpark } from "@/components/mira/MiraSpark";
import {
  ArrowLeft,
  ArrowUp,
  LoaderCircle,
  Mic,
  Settings2,
  Square,
  Volume2,
  VolumeX,
} from "lucide-react";

type VoiceMessage = {
  role: "user" | "assistant";
  content: string;
};

type MiraVoiceConversationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: readonly VoiceMessage[];
  draft: string;
  onDraftChange: (value: string) => void;
  transcript: string;
  loading: boolean;
  listening: boolean;
  sessionActive: boolean;
  canStart: boolean;
  supportMessage: string | null;
  speaking: boolean;
  speechPlaybackFailed: boolean;
  error: string | null;
  provider: string;
  routing: string;
  contextNotice: string;
  attachmentsPending: boolean;
  onStartConversation: () => void;
  onStopConversation: () => void;
  onStopSpeaking: () => void;
  onSend: () => void;
  onRetryTranscript: () => void;
  onOpenSettings: () => void;
  onReplayLatestAnswer: () => void;
};

export function MiraVoiceConversationDialog({
  open,
  onOpenChange,
  messages,
  draft,
  onDraftChange,
  transcript,
  loading,
  listening,
  sessionActive,
  canStart,
  supportMessage,
  speaking,
  speechPlaybackFailed,
  error,
  provider,
  routing,
  contextNotice,
  attachmentsPending,
  onStartConversation,
  onStopConversation,
  onStopSpeaking,
  onSend,
  onRetryTranscript,
  onOpenSettings,
  onReplayLatestAnswer,
}: MiraVoiceConversationDialogProps) {
  const latestAssistant = [...messages].reverse().find((message) => message.role === "assistant");
  const latestUser = [...messages].reverse().find((message) => message.role === "user");
  const status = loading
    ? "Mira formuliert eine Antwort …"
    : speaking && listening
      ? "Mira spricht – sprich einfach hinein, um sie zu unterbrechen."
      : listening
        ? "Ich höre dir zu …"
        : speaking
          ? "Mira spricht gerade"
          : sessionActive
            ? "Das Gespräch läuft; ich bereite das Zuhören vor …"
            : "Tippe auf „Gespräch starten“, wenn du bereit bist.";
  const orbState = loading
    ? "is-thinking"
    : speaking
      ? "is-speaking"
      : listening
        ? "is-listening"
        : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="mira-voice-dialog fixed left-0 top-0 z-50 grid h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-none border-0 bg-[#05080d] p-0 text-white shadow-none sm:rounded-none">
        <DialogTitle className="sr-only">Sprachgespräch mit Mira</DialogTitle>
        <DialogDescription className="sr-only">
          Sprich mit Mira im selben Chatverlauf oder schreibe ihr unten eine Nachricht.
        </DialogDescription>

        <header className="flex items-center gap-3 border-b border-white/10 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Zum Textchat zurückkehren"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 p-2">
              <MiraSpark />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-wide">Mira</p>
              <p className="truncate text-[11px] text-white/60">Sprachgespräch · Alo</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="KI-Anbieter-Einstellungen öffnen"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
          >
            <Settings2 className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <main className="mira-voice-stage min-h-0 overflow-y-auto px-[max(1rem,env(safe-area-inset-left))] py-5 [scrollbar-width:thin]">
          <div className="flex min-h-full flex-col items-center justify-center gap-4 text-center">
            <div
              className={`mira-voice-orb ${orbState}`}
              role="img"
              aria-label="Miras leuchtendes Sternsymbol"
            >
              <span className="mira-voice-orb__mark">
                <MiraSpark />
              </span>
            </div>

            <div className="w-full max-w-xl px-2">
              <p className="text-base font-medium text-white" aria-live="polite">
                {status}
              </p>
              <p className="mx-auto mt-2 max-w-lg text-xs leading-relaxed text-white/60">
                Außerhalb einer gestarteten Sitzung bleibt das Mikrofon aus. Während des Gesprächs
                wird erkannter Text automatisch an den angezeigten Mira-Anbieter gesendet und Miras
                Antwort mit der bevorzugten deutschen Gerätestimme vorgelesen. Auch währenddessen
                hört die Browser-Erkennung zu, damit du hineinsprechen kannst; Miras gerade gelesene
                Wörter werden soweit möglich als Echo ausgefiltert. Je nach Browser kann die
                Spracherkennung Audio zur Verarbeitung an einen Browserdienst senden; sie ist nicht
                immer lokal. Mira erhält den erkannten Text, nicht die rohe Aufnahme.
              </p>
              {supportMessage && (
                <p role="status" className="mx-auto mt-3 max-w-lg text-xs text-amber-100/90">
                  {supportMessage}
                </p>
              )}
            </div>

            {transcript && (
              <section
                className="w-full max-w-xl rounded-2xl border border-cyan-100/15 bg-white/[0.06] px-4 py-3 text-left"
                aria-label="Erkannte Sprache"
                aria-live="polite"
              >
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100/70">
                  Du
                </p>
                <p className="max-h-20 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-white/90">
                  {transcript}
                </p>
              </section>
            )}

            {transcript && !listening && !loading && (
              <button
                type="button"
                onClick={onRetryTranscript}
                className="min-h-11 rounded-full border border-cyan-100/25 bg-cyan-100/10 px-4 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-100/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
              >
                Erkannten Beitrag senden
              </button>
            )}

            {latestUser && !transcript && (
              <section className="w-full max-w-xl rounded-2xl border border-white/5 bg-white/[0.035] px-4 py-2 text-left">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
                  Du
                </p>
                <p className="max-h-16 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-white/75">
                  {latestUser.content}
                </p>
              </section>
            )}

            {latestAssistant && (
              <section className="w-full max-w-xl rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-left">
                <p className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100/75">
                  <span className="h-3 w-3">
                    <MiraSpark />
                  </span>
                  Mira
                </p>
                <div className="max-h-[20dvh] overflow-y-auto text-sm leading-relaxed text-white/90">
                  <MiraAnswerText text={latestAssistant.content} />
                </div>
              </section>
            )}
          </div>
        </main>

        <footer className="border-t border-white/10 bg-black/35 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto mb-2 flex max-w-3xl flex-wrap items-center justify-between gap-x-3 gap-y-1 px-1 text-[10px] text-white/55">
            <span className="truncate">Anbieter: {provider}</span>
            <details className="max-w-full">
              <summary className="cursor-pointer rounded px-1 py-1 text-cyan-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200">
                Daten & Routing
              </summary>
              <div className="mt-1 max-w-lg rounded-xl border border-white/10 bg-[#111720] p-3 text-xs leading-relaxed text-white/75">
                <p>{routing}</p>
                <p className="mt-2">{contextNotice}</p>
                <p className="mt-2">
                  Die Spracherkennung läuft über den Browser; je nach Browser kann dabei Audio an
                  dessen Erkennungsdienst übertragen werden. Mira erhält den erkannten Text und den
                  bestehenden Chatverlauf, nicht die rohe Sprachaufnahme.
                </p>
              </div>
            </details>
          </div>

          {attachmentsPending && (
            <p className="mx-auto mb-2 max-w-3xl rounded-xl border border-amber-200/20 bg-amber-200/10 px-3 py-2 text-xs text-amber-50/85">
              Vorhandene Anhänge bleiben im Textchat und werden mit Sprachbeiträgen nicht gesendet.
            </p>
          )}

          {error && (
            <p
              role="alert"
              className="mx-auto mb-2 max-w-3xl rounded-xl border border-red-200/25 bg-red-950/60 px-3 py-2 text-xs text-red-100"
            >
              {error}
            </p>
          )}

          {speechPlaybackFailed && latestAssistant && (
            <button
              type="button"
              onClick={onReplayLatestAnswer}
              aria-label="Miras letzte Antwort direkt vorlesen"
              className="mx-auto mb-2 flex min-h-11 max-w-3xl items-center justify-center gap-2 rounded-full border border-cyan-100/25 bg-cyan-100/10 px-4 text-xs font-semibold text-cyan-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
            >
              <Volume2 className="h-4 w-4" aria-hidden="true" />
              Antwort direkt vorlesen
            </button>
          )}

          <div className="mx-auto mb-2 max-w-3xl">
            <button
              type="button"
              onClick={sessionActive ? onStopConversation : onStartConversation}
              aria-label={sessionActive ? "Gespräch unterbrechen und stoppen" : "Gespräch starten"}
              aria-pressed={sessionActive}
              disabled={!sessionActive && (!canStart || loading)}
              className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 disabled:cursor-not-allowed disabled:opacity-45 ${
                sessionActive
                  ? "border border-red-200/45 bg-red-500/20 text-red-50 hover:bg-red-500/30"
                  : "bg-cyan-100 text-slate-950 hover:bg-white"
              }`}
            >
              {sessionActive ? (
                <>
                  <Square className="h-4 w-4" aria-hidden="true" />
                  Unterbrechen / Gespräch beenden
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4" aria-hidden="true" />
                  Gespräch starten
                </>
              )}
            </button>
          </div>

          {loading && (
            <p className="mx-auto mb-2 max-w-3xl text-center text-[10px] text-white/50">
              Beim Stoppen oder Schließen wird das Mikrofon ausgeschaltet und eine spätere Antwort
              verworfen; eine bereits gesendete Anfrage kann serverseitig noch fertiglaufen.
            </p>
          )}

          <form
            className="mx-auto flex max-w-3xl items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              onSend();
            }}
          >
            <div className="flex min-w-0 flex-1 items-end rounded-[1.7rem] border border-white/15 bg-white/[0.09] p-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.3)]">
              <textarea
                aria-label="Nachricht an Mira schreiben"
                value={draft}
                onChange={(event) => onDraftChange(event.target.value)}
                placeholder="Schreib Mira etwas …"
                rows={1}
                disabled={loading || listening}
                className="max-h-28 min-h-11 min-w-0 flex-1 resize-y bg-transparent px-3 py-3 text-sm leading-relaxed text-white outline-none placeholder:text-white/45 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-200 disabled:opacity-60"
              />
              <button
                type="submit"
                aria-label="Nachricht an Mira senden"
                disabled={loading || listening || !draft.trim()}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-cyan-100 text-slate-950 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowUp className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {speaking && (
              <button
                type="button"
                onClick={onStopSpeaking}
                aria-label="Mira unterbrechen und selbst sprechen"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
              >
                <VolumeX className="h-5 w-5" aria-hidden="true" />
              </button>
            )}
          </form>

          <p className="mx-auto mt-2 max-w-3xl text-center text-[10px] leading-relaxed text-white/45">
            {sessionActive
              ? "Mira hört während ihrer Antwort weiter zu. Sprich einfach hinein oder tippe auf Stopp; das Gespräch endet erst, wenn du es beendest."
              : "Das Mikrofon bleibt aus, bis du ausdrücklich „Gespräch starten“ antippst."}
          </p>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
