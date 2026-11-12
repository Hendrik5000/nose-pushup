import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { MiraSpark } from "@/components/mira/MiraSpark";
import type { MiraVoiceConversationPhase } from "@/lib/mira-voice-conversation";
import { ArrowLeft, MessageCircle, Mic, MicOff, VolumeX, X } from "lucide-react";
import "@/mira-voice.css";

type MiraVoiceConversationDialogProps = {
  open: boolean;
  phase: MiraVoiceConversationPhase;
  transcript: string;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onStart: () => void;
  onStop: () => void;
  onInterruptSpeech: () => void;
};

function getStatus(phase: MiraVoiceConversationPhase): string {
  switch (phase) {
    case "listening":
      return "Ich höre zu. Sprich einfach los.";
    case "thinking":
      return "Mira denkt kurz nach …";
    case "speaking":
      return "Mira spricht. Du kannst sie jederzeit unterbrechen.";
    case "error":
      return "Das Sprachgespräch ist pausiert.";
    default:
      return "Starte das Gespräch, wenn du bereit bist.";
  }
}

export function MiraVoiceConversationDialog({
  open,
  phase,
  transcript,
  error,
  onOpenChange,
  onStart,
  onStop,
  onInterruptSpeech,
}: MiraVoiceConversationDialogProps) {
  const active = phase === "listening" || phase === "thinking" || phase === "speaking";
  const orbState =
    phase === "listening"
      ? "is-listening"
      : phase === "thinking" || phase === "speaking"
        ? `is-${phase}`
        : "";
  const micAction = phase === "speaking" ? onInterruptSpeech : active ? onStop : onStart;
  const micLabel =
    phase === "speaking"
      ? "Mira unterbrechen und weiter zuhören"
      : active
        ? "Sprachgespräch beenden und Mikrofon ausschalten"
        : "Sprachgespräch mit Mira starten";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="mira-voice-dialog fixed inset-0 z-50 grid h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-none border-0 p-0 text-white shadow-none sm:rounded-none">
        <DialogTitle className="sr-only">Sprachgespräch mit Mira</DialogTitle>
        <DialogDescription className="sr-only">
          Ein bewusst gestartetes Sprachgespräch mit Mira. Du kannst Mira jederzeit unterbrechen
          oder die Ansicht schließen, um zum Textchat zurückzukehren.
        </DialogDescription>

        <header className="mira-voice-header flex items-center justify-between gap-3 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Zum Mira-Chat zurückkehren"
            className="mira-voice-icon-button"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </button>

          <div
            className="flex min-w-0 items-center gap-2.5"
            role="group"
            aria-label="Mira Sprachgespräch"
          >
            <span className="mira-voice-brand-mark" aria-hidden="true">
              <MiraSpark />
            </span>
            <div className="min-w-0 text-left">
              <p className="truncate text-sm font-semibold tracking-wide">Mira</p>
              <p className="truncate text-[11px] text-white/55">Sprachgespräch</p>
            </div>
          </div>
        </header>

        <main className="mira-voice-stage min-h-0 overflow-y-auto py-5">
          <div className="mira-voice-stage__content flex min-h-full flex-col items-center justify-center gap-5 text-center">
            <div
              className={`mira-voice-orb ${orbState}`}
              role="img"
              aria-label="Miras blau leuchtendes, animiertes Orb"
            />

            <div className="w-full max-w-xl px-2">
              <p className="text-base font-medium text-white" aria-live="polite">
                {getStatus(phase)}
              </p>
              {phase === "idle" && (
                <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-white/55">
                  Dein Mikrofon bleibt aus, bis du das Gespräch bewusst startest.
                </p>
              )}
            </div>

            {transcript && (
              <section
                className="mira-voice-transcript w-full max-w-xl"
                aria-label="Zuletzt erkannter Text"
                aria-live="polite"
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-100/65">
                  Du
                </p>
                <p className="mt-1 max-h-24 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-white/90">
                  {transcript}
                </p>
              </section>
            )}

            {error && (
              <p
                role="alert"
                className="mx-auto w-full max-w-xl rounded-2xl border border-red-200/20 bg-red-950/55 px-4 py-3 text-left text-sm text-red-100"
              >
                {error}
              </p>
            )}
          </div>
        </main>

        <footer className="mira-voice-footer px-3 pb-[max(0.85rem,env(safe-area-inset-bottom))] pt-3">
          <div className="mira-voice-controls mx-auto flex w-full max-w-3xl items-center gap-2.5">
            <div
              className="mira-voice-conversation-pill"
              role="group"
              aria-label="Status des Sprachgesprächs"
            >
              <MessageCircle className="h-5 w-5 shrink-0 text-white/75" aria-hidden="true" />
              <div className="min-w-0 text-left">
                <p className="truncate text-sm text-white/90">
                  {transcript || (active ? getStatus(phase) : "Mit Mira sprechen")}
                </p>
                <p className="truncate text-[10px] text-white/50">
                  {active ? "Sprachgespräch aktiv" : "Mira wartet auf deinen Start"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={micAction}
              aria-label={micLabel}
              aria-pressed={active}
              className={`mira-voice-control-button ${active ? "is-active" : "is-ready"}`}
            >
              {phase === "speaking" ? (
                <VolumeX className="h-5 w-5" aria-hidden="true" />
              ) : active ? (
                <MicOff className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Mic className="h-5 w-5" aria-hidden="true" />
              )}
            </button>

            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Sprachansicht schließen und zum Mira-Chat zurückkehren"
              className="mira-voice-close-button"
            >
              <X className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
