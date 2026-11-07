import type { MiraSpeechRecognitionLike } from "@/lib/mira-voice-conversation";

type RecognitionEvent = Parameters<NonNullable<MiraSpeechRecognitionLike["onresult"]>>[0];
type RecognitionError = Parameters<NonNullable<MiraSpeechRecognitionLike["onerror"]>>[0];

export type MiraInlineDictationOptions = {
  createRecognition: () => MiraSpeechRecognitionLike | null;
  onTranscript: (transcript: string) => void;
  onInterimTranscript?: (transcript: string) => void;
  onListeningChange?: (listening: boolean) => void;
  onError?: (message: string) => void;
};

function getRecognitionErrorMessage(error?: string): string {
  if (error === "not-allowed" || error === "service-not-allowed") {
    return "Mikrofonzugriff wurde nicht erlaubt. Prüfe die Browser-Berechtigung und tippe erneut.";
  }
  if (error === "audio-capture") {
    return "Kein verwendbares Mikrofon gefunden. Prüfe dein Gerät und versuche es erneut.";
  }
  if (error === "no-speech") {
    return "Es wurde keine Sprache erkannt. Tippe auf das Mikrofon und versuche es erneut.";
  }
  return "Spracherkennung fehlgeschlagen. Versuche es erneut oder nutze den Textchat.";
}

/** A one-shot browser SpeechRecognition session that never sends text. */
export class MiraInlineDictationController {
  private recognition: MiraSpeechRecognitionLike | null = null;
  private session = 0;
  private listening = false;
  private stopping = false;
  private readonly processedFinalResults = new Set<number>();

  constructor(private readonly options: MiraInlineDictationOptions) {}

  start(): boolean {
    if (this.recognition && !this.stopping) return false;
    if (this.recognition) this.cancel();

    let recognition: MiraSpeechRecognitionLike | null;
    try {
      recognition = this.options.createRecognition();
    } catch {
      this.options.onError?.(
        "Das Mikrofon konnte nicht gestartet werden. Prüfe die Berechtigung und versuche es erneut.",
      );
      return false;
    }
    if (!recognition) {
      this.options.onError?.("Spracherkennung wird in diesem Browser nicht unterstützt.");
      return false;
    }

    const session = ++this.session;
    this.recognition = recognition;
    this.listening = true;
    this.stopping = false;
    this.processedFinalResults.clear();
    recognition.lang = "de-DE";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event: RecognitionEvent) => {
      if (!this.isCurrent(recognition, session)) return;
      const interimTranscripts: string[] = [];
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (!result) continue;
        const transcript = result[0]?.transcript?.trim();
        if (!result.isFinal) {
          if (transcript) interimTranscripts.push(transcript);
          continue;
        }
        if (this.processedFinalResults.has(index)) continue;
        this.processedFinalResults.add(index);
        if (transcript) this.options.onTranscript(transcript);
      }
      this.options.onInterimTranscript?.(interimTranscripts.join(" "));
    };
    recognition.onerror = (event?: RecognitionError) => {
      if (!this.isCurrent(recognition, session)) return;
      this.options.onError?.(getRecognitionErrorMessage(event?.error));
      this.finish(recognition, session);
    };
    recognition.onend = () => this.finish(recognition, session);

    this.options.onListeningChange?.(true);
    try {
      recognition.start();
      return true;
    } catch {
      this.options.onError?.(
        "Das Mikrofon konnte nicht gestartet werden. Prüfe die Berechtigung und versuche es erneut.",
      );
      this.finish(recognition, session);
      return false;
    }
  }

  /** Stop normally, allowing a final recognition result to arrive before `onend`. */
  stop(): void {
    const recognition = this.recognition;
    if (!recognition || this.stopping) return;
    this.stopping = true;
    this.setListening(false);
    try {
      recognition.stop();
    } catch {
      this.finish(recognition, this.session);
    }
  }

  /** Cancel and invalidate queued events so they cannot update another draft. */
  cancel(): void {
    this.release(true);
  }

  /** Unmount cleanup: stop browser capture without calling React state setters. */
  dispose(): void {
    this.release(false);
  }

  private isCurrent(recognition: MiraSpeechRecognitionLike, session: number): boolean {
    return this.recognition === recognition && this.session === session;
  }

  private finish(recognition: MiraSpeechRecognitionLike, session: number): void {
    if (!this.isCurrent(recognition, session)) return;
    this.recognition = null;
    this.stopping = false;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    this.setListening(false);
  }

  private release(notify: boolean): void {
    const recognition = this.recognition;
    const wasListening = this.listening;
    this.session += 1;
    this.recognition = null;
    this.stopping = false;
    this.listening = false;
    this.processedFinalResults.clear();
    if (recognition) {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try {
        if (recognition.abort) recognition.abort();
        else recognition.stop();
      } catch {
        // The browser may already have closed this recognition session.
      }
    }
    if (notify && wasListening) this.options.onListeningChange?.(false);
  }

  private setListening(value: boolean): void {
    if (this.listening === value) return;
    this.listening = value;
    this.options.onListeningChange?.(value);
  }
}

type TimerScheduler = {
  setTimeout: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
  clearTimeout: (timer: ReturnType<typeof setTimeout>) => void;
};

type ActivePointer = { id: number; x: number; y: number };

/** Short taps remain edits; a hold starts push-to-talk and release ends it. */
export class MiraComposerPressAndHold {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pointer: ActivePointer | null = null;
  private triggered = false;

  constructor(
    private readonly onStart: () => void,
    private readonly onStop: () => void,
    private readonly onCancel: () => void,
    private readonly delayMs = 300,
    private readonly movementThreshold = 12,
    private readonly scheduler: TimerScheduler = globalThis,
  ) {}

  pointerDown(pointerId: number, x: number, y: number, isPrimary = true): void {
    if (!isPrimary || this.pointer) return;
    this.pointer = { id: pointerId, x, y };
    this.timer = this.scheduler.setTimeout(() => {
      this.timer = null;
      if (!this.pointer || this.pointer.id !== pointerId) return;
      this.triggered = true;
      this.onStart();
    }, this.delayMs);
  }

  pointerMove(pointerId: number, x: number, y: number): boolean {
    if (!this.pointer || this.pointer.id !== pointerId) return false;
    if (Math.hypot(x - this.pointer.x, y - this.pointer.y) > this.movementThreshold) {
      this.cancelPointer();
      return true;
    }
    return false;
  }

  pointerUp(pointerId: number): void {
    if (!this.pointer || this.pointer.id !== pointerId) return;
    const shouldStop = this.triggered;
    this.reset();
    if (shouldStop) this.onStop();
  }

  pointerCancel(pointerId: number): boolean {
    if (!this.pointer || this.pointer.id !== pointerId) return false;
    this.cancelPointer();
    return true;
  }

  /** Clear a pending press without affecting a dictation started by another control. */
  reset(): void {
    this.clearTimer();
    this.pointer = null;
    this.triggered = false;
  }

  /** Unmount cleanup also cancels a hold that has already activated dictation. */
  dispose(): void {
    const shouldCancel = this.triggered;
    this.reset();
    if (shouldCancel) this.onCancel();
  }

  private cancelPointer(): void {
    const shouldCancel = this.triggered;
    this.reset();
    if (shouldCancel) this.onCancel();
  }

  private clearTimer(): void {
    if (this.timer !== null) this.scheduler.clearTimeout(this.timer);
    this.timer = null;
  }
}
