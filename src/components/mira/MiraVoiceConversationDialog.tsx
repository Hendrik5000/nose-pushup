import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Mic, MicOff, MessageCircle, Volume2, X } from "lucide-react";
import type { MiraVoiceConversationPhase } from "@/lib/mira-voice-conversation";
import "./MiraVoiceConversationDialog.css";

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
      return "Dein Mikrofon bleibt aus, bis du das Gespräch bewusst startest.";
  }
}

function getControlHint(phase: MiraVoiceConversationPhase): string {
  switch (phase) {
    case "listening":
      return "Mira hört dir zu";
    case "thinking":
      return "Mira verarbeitet deine Frage";
    case "speaking":
      return "Mira antwortet gerade";
    case "error":
      return "Das Gespräch ist pausiert";
    default:
      return "Mira wartet auf deinen Start";
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
  const idle = phase === "idle";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="mira-voice-fullscreen-dialog !translate-x-0 !translate-y-0">
        <header className="mira-voice-header">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="mira-voice-back-button"
            aria-label="Zurück zum Mira-Chat"
          >
            <ArrowLeft aria-hidden="true" />
          </button>
          <div className="mira-voice-brand">
            <span className="mira-voice-brand-mark" aria-hidden="true">
              <span />
            </span>
            <div className="mira-voice-brand-copy">
              <DialogTitle className="mira-voice-brand-title">Mira</DialogTitle>
              <DialogDescription className="mira-voice-brand-subtitle">
                Sprachgespräch
              </DialogDescription>
            </div>
          </div>
          <span className="mira-voice-header-spacer" aria-hidden="true" />
        </header>

        <main className="mira-voice-main" aria-label="Mira-Freisprechgespräch">
          <div className="mira-voice-primary-stage">
            <div className="mira-voice-orb" data-phase={phase} aria-hidden="true" />

            <section className="mira-voice-status-block" aria-label="Gesprächsstatus">
              <p className="mira-voice-status" role="status" aria-live="polite">
                {idle ? "Starte das Gespräch, wenn du bereit bist." : getStatus(phase)}
              </p>
              {idle && <p className="mira-voice-microphone-note">{getStatus(phase)}</p>}
              <p className="mira-voice-provider">
                Anbieter-Vorschau: {providerLabel ?? "kein aktiver Anbieter"}. Die endgültige
                Auswahl erfolgt wie im Textchat anhand deiner Frage.
              </p>
            </section>
          </div>

          {transcript && (
            <section
              className="mira-voice-transcript"
              aria-label="Zuletzt erkannter Text"
              aria-live="polite"
            >
              <p className="mira-voice-eyebrow">Erkannter Text</p>
              <p className="mira-voice-transcript-text">{transcript}</p>
            </section>
          )}

          {error && (
            <p role="alert" className="mira-voice-error">
              {error}
            </p>
          )}

          <details className="mira-voice-disclosure">
            <summary>Datenschutz &amp; Gesprächsablauf</summary>
            <div className="mira-voice-disclosure-copy">
              <p>
                Starte die Sitzung bewusst. Danach werden erkannte Sätze über denselben
                Mira-Anbieter wie im Textchat gesendet und Antworten mit der Gerätestimme
                vorgelesen.
              </p>
              <p>
                Dein Browser wandelt Sprache in Text um. Je nach Browser kann dafür Audio an einen
                Browser-Spracherkennungsdienst übertragen werden; eine lokale Verarbeitung ist nicht
                garantiert. Mira erhält nur den erkannten Text, keine rohe Mikrofonaufnahme. Der
                Text aus deinem normalen Entwurf und vorhandene Anhänge werden nicht mitgesendet.
              </p>
              <p>
                Die Sprachausgabe nutzt die eingebaute Stimme deines Geräts. Stimme, Verfügbarkeit
                und Unterbrechungsverhalten hängen von Browser und Gerät ab.
              </p>
              <p>
                Bereits gesendete Anfragen lassen sich hier nicht zurückholen; ihre Textantwort kann
                noch im Chat ankommen, wird nach dem Beenden aber nicht mehr vorgelesen.
              </p>
            </div>
          </details>
        </main>

        <footer className="mira-voice-footer">
          {phase === "speaking" && (
            <button
              type="button"
              onClick={onInterruptSpeech}
              className="mira-voice-interrupt-button"
              aria-label="Miras Antwort unterbrechen und weiter zuhören"
            >
              <Volume2 aria-hidden="true" />
              Antwort unterbrechen
            </button>
          )}

          <div className="mira-voice-controls">
            <div className="mira-voice-control-caption">
              <MessageCircle aria-hidden="true" />
              <div>
                <p className="mira-voice-control-title">Mit Mira sprechen</p>
                <p className="mira-voice-control-hint">{getControlHint(phase)}</p>
              </div>
            </div>

            {active ? (
              <button
                type="button"
                onClick={onStop}
                className="mira-voice-control-button is-stop"
                aria-label="Freisprechgespräch beenden und Mikrofon ausschalten"
              >
                <MicOff aria-hidden="true" />
                <span className="sr-only">Gespräch beenden</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onStart}
                className="mira-voice-control-button is-start"
                aria-label="Freisprechgespräch starten und Mikrofon aktivieren"
              >
                <Mic aria-hidden="true" />
                <span className="sr-only">Gespräch starten</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="mira-voice-control-button is-close"
              aria-label="Sprachgespräch schließen"
            >
              <X aria-hidden="true" />
              <span className="sr-only">Schließen</span>
            </button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
