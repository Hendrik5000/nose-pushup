import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Check, Mic, MicOff, Trash2 } from "lucide-react";

type MiraVoiceChatDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transcript: string;
  onTranscriptChange: (value: string) => void;
  listening: boolean;
  onStartListening: () => void;
  onStopListening: () => void;
  error: string | null;
  onContinue?: () => void;
  continueLabel?: string;
  className?: string;
};

export function MiraVoiceChatDialog({
  open,
  onOpenChange,
  transcript,
  onTranscriptChange,
  listening,
  onStartListening,
  onStopListening,
  error,
  onContinue,
  continueLabel = "Übernehmen",
  className = "alo-dialog max-h-[88dvh] overflow-y-auto sm:max-w-md",
}: MiraVoiceChatDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={className}>
        <DialogTitle className="pr-8">Mit Mira sprechen</DialogTitle>
        <DialogDescription>
          Du kannst Mira per Halten-zum-Sprechen oder durch Antippen diktieren. Je nach Browser kann
          die Spracherkennung über einen Browser-Dienst verarbeitet werden. Prüfe oder bearbeite den
          erkannten Text und tippe danach selbst auf „Frage in Mira prüfen“; nichts wird automatisch
          an Mira gesendet. Mira wird nicht automatisch kontaktiert.
        </DialogDescription>
        <p className="rounded-xl border border-border/70 bg-background/60 p-3 text-sm text-muted-foreground">
          Antworten kannst du einzeln über „Vorlesen“ anhören. Stimme und Tempo richten sich nach
          den Möglichkeiten deines Geräts.
        </p>

        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border/70 bg-background/60 p-5 text-center">
          <button
            type="button"
            onClick={listening ? onStopListening : onStartListening}
            aria-label={listening ? "Spracherkennung beenden" : "Mikrofon starten"}
            aria-pressed={listening}
            className={`flex min-h-14 min-w-14 items-center justify-center gap-2 rounded-full border px-5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
              listening
                ? "border-destructive/40 bg-destructive/10 text-destructive"
                : "border-primary/30 bg-primary/15 text-primary"
            }`}
          >
            {listening ? (
              <>
                <MicOff className="h-5 w-5" aria-hidden="true" />
                Aufnahme beenden
              </>
            ) : (
              <>
                <Mic className="h-5 w-5" aria-hidden="true" />
                Jetzt sprechen
              </>
            )}
          </button>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {listening
              ? "Mikrofon aktiv – sprich jetzt. Es wird nichts automatisch gesendet."
              : "Das Mikrofon wird erst nach deinem Tipp aktiviert."}
          </p>
        </div>

        <label className="space-y-2 text-sm font-medium">
          Erkannter Text · vor dem Senden bearbeitbar
          <textarea
            aria-label="Erkannten Text bearbeiten"
            className="min-h-32 w-full resize-y rounded-xl border border-border bg-background p-3 font-normal outline-none focus-visible:ring-2 focus-visible:ring-primary"
            value={transcript}
            onChange={(event) => onTranscriptChange(event.target.value)}
            placeholder="Deine gesprochenen Worte erscheinen hier …"
            rows={5}
          />
        </label>

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          {transcript.trim() && (
            <button
              type="button"
              onClick={() => onTranscriptChange("")}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm text-muted-foreground"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Entwurf leeren
            </button>
          )}
          <button
            type="button"
            onClick={() => (onContinue ? onContinue() : onOpenChange(false))}
            disabled={Boolean(onContinue && !transcript.trim())}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            <Check className="h-4 w-4" aria-hidden="true" />
            {continueLabel}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
