import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Mic, MicOff, Volume2 } from "lucide-react";
import type { MiraVoiceConversationPhase } from "@/lib/mira-voice-conversation";

type MiraVoiceConversationDialogProps = {
  open: boolean;
  phase: MiraVoiceConversationPhase;
  transcript: string;
  providerLabel: string | null;
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
      return "Mira verarbeitet deinen erkannten Text …";
    case "speaking":
      return "Mira antwortet. Du kannst sie mit deiner Stimme oder der Taste unterbrechen.";
    case "error":
      return "Das Sprachgespräch ist pausiert.";
    default:
      return "Das Mikrofon bleibt aus, bis du das Gespräch startest.";
  }
}

export function MiraVoiceConversationDialog({
  open,
  phase,
  transcript,
  providerLabel,
  error,
  onOpenChange,
  onStart,
  onStop,
  onInterruptSpeech,
}: MiraVoiceConversationDialogProps) {
  const active = phase === "listening" || phase === "thinking" || phase === "speaking";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="alo-dialog max-h-[88dvh] overflow-y-auto sm:max-w-xl">
        <DialogTitle className="pr-8">Freisprechen mit Mira</DialogTitle>
        <DialogDescription>
          Starte die Sitzung bewusst. Danach werden erkannte Sätze über denselben Mira-Anbieter wie
          im Textchat gesendet und Antworten mit der Gerätestimme vorgelesen.
        </DialogDescription>

        <section className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm leading-relaxed">
          <p>
            Dein Browser wandelt Sprache in Text um. Je nach Browser kann dafür Audio an einen
            Browser-Spracherkennungsdienst übertragen werden; eine lokale Verarbeitung ist nicht
            garantiert. Mira erhält nur den erkannten Text, keine rohe Mikrofonaufnahme. Der Text
            aus deinem normalen Entwurf und vorhandene Anhänge werden nicht mitgesendet.
          </p>
          <p className="mt-2 text-muted-foreground">
            Die Sprachausgabe nutzt die eingebaute Stimme deines Geräts. Stimme, Verfügbarkeit und
            Unterbrechungsverhalten hängen von Browser und Gerät ab.
          </p>
          <p className="mt-2 text-muted-foreground">
            Bereits gesendete Anfragen lassen sich hier nicht zurückholen; ihre Textantwort kann
            noch im Chat ankommen, wird nach dem Beenden aber nicht mehr vorgelesen.
          </p>
        </section>

        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border/70 bg-background/60 p-5 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
            {phase === "speaking" ? (
              <Volume2 className="h-7 w-7" aria-hidden="true" />
            ) : phase === "listening" ? (
              <Mic className="h-7 w-7" aria-hidden="true" />
            ) : (
              <MicOff className="h-7 w-7" aria-hidden="true" />
            )}
          </div>
          <p className="text-sm font-semibold" aria-live="polite">
            {getStatus(phase)}
          </p>
          <p className="text-xs text-muted-foreground">
            Anbieter-Vorschau: {providerLabel ?? "kein aktiver Anbieter"}. Die endgültige Auswahl
            erfolgt wie im Textchat anhand deiner Frage.
          </p>

          <div className="flex flex-wrap justify-center gap-2">
            {active ? (
              <button
                type="button"
                onClick={onStop}
                className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-4 text-sm font-semibold text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="Freisprechgespräch beenden und Mikrofon ausschalten"
              >
                <MicOff className="h-4 w-4" aria-hidden="true" />
                Gespräch beenden
              </button>
            ) : (
              <button
                type="button"
                onClick={onStart}
                className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                aria-label="Freisprechgespräch starten und Mikrofon aktivieren"
              >
                <Mic className="h-4 w-4" aria-hidden="true" />
                Gespräch starten
              </button>
            )}
            {phase === "speaking" && (
              <button
                type="button"
                onClick={onInterruptSpeech}
                className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="Miras Antwort unterbrechen und weiter zuhören"
              >
                Antwort unterbrechen
              </button>
            )}
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex min-h-12 items-center rounded-xl border border-border px-4 text-sm font-medium text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Schließen
            </button>
          </div>
        </div>

        {transcript && (
          <section
            className="rounded-xl border border-border bg-background/60 p-3"
            aria-label="Zuletzt erkannter Text"
            aria-live="polite"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Erkannter Text
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm">{transcript}</p>
          </section>
        )}

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          >
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
