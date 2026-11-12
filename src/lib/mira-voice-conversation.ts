import {
  getMiraSpeechSettings,
  prepareMiraSpeechText,
  type MiraVoiceOption,
} from "@/lib/mira-voice";

export type MiraVoiceConversationPhase = "idle" | "listening" | "thinking" | "speaking" | "error";

type RecognitionAlternativeLike = { transcript?: string };
type RecognitionResultLike = {
  isFinal?: boolean;
  0?: RecognitionAlternativeLike;
};
type RecognitionResultsLike = {
  length: number;
  [index: number]: RecognitionResultLike;
};
type RecognitionErrorLike = { error?: string };

export type MiraSpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort?: () => void;
  onresult: ((event: { resultIndex: number; results: RecognitionResultsLike }) => void) | null;
  onerror: ((event?: RecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
};

export type MiraSpeechUtteranceLike = {
  lang: string;
  rate: number;
  pitch: number;
  volume: number;
  voice: MiraVoiceOption | null;
  onend: (() => void) | null;
  onerror: ((event?: { error?: string }) => void) | null;
};

export type MiraSpeechSynthesisLike = {
  getVoices: () => readonly MiraVoiceOption[];
  speak: (utterance: MiraSpeechUtteranceLike) => void;
  cancel: () => void;
  resume?: () => void;
};

export type MiraVoiceConversationControllerOptions = {
  createRecognition: () => MiraSpeechRecognitionLike | null;
  speechSynthesis: MiraSpeechSynthesisLike | null;
  createUtterance: (text: string) => MiraSpeechUtteranceLike;
  sendTranscript: (transcript: string) => Promise<string | null>;
  onPhaseChange?: (phase: MiraVoiceConversationPhase) => void;
  onTranscriptChange?: (transcript: string) => void;
  onErrorChange?: (error: string | null) => void;
};

const RECOGNITION_RESTART_MS = 250;
const END_OF_UTTERANCE_MS = 550;
const INTERRUPTION_COMMANDS = new Set(["halt", "nein", "stopp", "stop", "warte", "moment"]);

function normalizeSpeech(value: string): string {
  return value
    .toLocaleLowerCase("de-DE")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** True for a recognized phrase that is probably a contiguous fragment of Mira's current audio. */
export function isLikelyMiraSpeechEcho(candidate: string, spokenText: string): boolean {
  const candidateWords = normalizeSpeech(candidate).split(" ").filter(Boolean);
  const spokenWords = normalizeSpeech(spokenText).split(" ").filter(Boolean);
  if (!candidateWords.length || !spokenWords.length) return false;
  if (candidateWords.length === 1 && INTERRUPTION_COMMANDS.has(candidateWords[0])) return false;
  if (candidateWords.length === 1) {
    return candidateWords[0].length >= 5 && spokenWords.includes(candidateWords[0]);
  }
  if (candidateWords.length > spokenWords.length) return false;
  return spokenWords.some((_, start) =>
    candidateWords.every((word, offset) => spokenWords[start + offset] === word),
  );
}

function joinTranscript(parts: readonly string[]): string {
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export class MiraVoiceConversationController {
  private active = false;
  private session = 0;
  private phase: MiraVoiceConversationPhase = "idle";
  private recognition: MiraSpeechRecognitionLike | null = null;
  private utterance: MiraSpeechUtteranceLike | null = null;
  private spokenText = "";
  private pendingFinals: string[] = [];
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private finalTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly options: MiraVoiceConversationControllerOptions) {}

  start(): void {
    if (this.active) return;
    this.session += 1;
    const session = this.session;
    this.active = true;
    this.pendingFinals = [];
    this.clearTimers();
    this.options.onTranscriptChange?.("");
    this.options.onErrorChange?.(null);

    if (!this.options.speechSynthesis) {
      this.fail(
        "Sprachausgabe wird von diesem Browser nicht unterstützt. Nutze bitte den Textchat.",
      );
      return;
    }

    this.setPhase("listening");
    this.startRecognition(session);
  }

  /** Stop is synchronous from the UI's perspective; stale browser events lose ownership immediately. */
  stop(): void {
    this.stopInternal(false);
  }

  dispose(): void {
    this.stopInternal(true);
  }

  private stopInternal(silent: boolean): void {
    this.active = false;
    this.session += 1;
    this.clearTimers();
    this.pendingFinals = [];
    this.stopRecognition();
    this.cancelSpeech();
    this.spokenText = "";
    if (silent) this.phase = "idle";
    else {
      this.options.onErrorChange?.(null);
      this.setPhase("idle");
    }
  }

  /** Stop the current answer but keep the explicitly started session listening for an interruption. */
  interruptSpeech(): void {
    if (!this.active || this.phase !== "speaking") return;
    this.cancelSpeech();
    this.setPhase("listening");
    if (!this.recognition) this.startRecognition(this.session);
  }

  private setPhase(phase: MiraVoiceConversationPhase): void {
    this.phase = phase;
    this.options.onPhaseChange?.(phase);
  }

  private isCurrentSession(session: number): boolean {
    return this.active && this.session === session;
  }

  private startRecognition(session: number): void {
    if (!this.isCurrentSession(session) || this.recognition) return;
    let recognition: MiraSpeechRecognitionLike | null;
    try {
      recognition = this.options.createRecognition();
    } catch {
      this.fail(
        "Das Mikrofon konnte nicht gestartet werden. Prüfe die Browser-Berechtigung und versuche es erneut.",
      );
      return;
    }
    if (!recognition) {
      this.fail(
        "Spracherkennung wird in diesem Browser nicht unterstützt. Nutze bitte die bearbeitbare Diktierfunktion oder den Textchat.",
      );
      return;
    }

    recognition.lang = "de-DE";
    recognition.continuous = true;
    recognition.interimResults = true;
    const processedFinals = new Set<number>();
    const interruptionCommandIndices = new Set<number>();
    this.recognition = recognition;

    recognition.onresult = (event) => {
      if (!this.isCurrentSession(session) || this.recognition !== recognition) return;
      const newFinals: string[] = [];
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result?.[0]?.transcript?.trim() ?? "";
        if (!transcript) continue;

        if (!result.isFinal) {
          if (this.phase === "speaking") {
            if (isLikelyMiraSpeechEcho(transcript, this.spokenText)) continue;
            const normalized = normalizeSpeech(transcript);
            if (INTERRUPTION_COMMANDS.has(normalized)) {
              interruptionCommandIndices.add(index);
              this.cancelSpeech();
              this.setPhase("listening");
              this.options.onErrorChange?.(null);
            }
          }
          if (this.phase === "listening")
            this.options.onTranscriptChange?.(joinTranscript([...this.pendingFinals, transcript]));
          continue;
        }

        if (processedFinals.has(index)) continue;
        processedFinals.add(index);
        const isInterruptionCommand = INTERRUPTION_COMMANDS.has(normalizeSpeech(transcript));
        if (this.phase === "speaking") {
          if (isLikelyMiraSpeechEcho(transcript, this.spokenText)) continue;
          this.cancelSpeech();
          this.setPhase("listening");
          if (isInterruptionCommand) {
            this.options.onTranscriptChange?.(joinTranscript(this.pendingFinals));
            continue;
          }
        }
        if (isInterruptionCommand && interruptionCommandIndices.has(index)) {
          interruptionCommandIndices.delete(index);
          this.options.onTranscriptChange?.(joinTranscript(this.pendingFinals));
          continue;
        }
        interruptionCommandIndices.delete(index);
        if (this.phase !== "listening") continue;
        newFinals.push(transcript);
      }

      if (newFinals.length) {
        this.pendingFinals.push(...newFinals);
        this.options.onTranscriptChange?.(joinTranscript(this.pendingFinals));
        this.scheduleFinalize(session);
        this.options.onErrorChange?.(null);
      }
    };

    recognition.onerror = (event) => {
      if (!this.isCurrentSession(session) || this.recognition !== recognition) return;
      const code = event?.error;
      if (code === "no-speech") {
        this.options.onErrorChange?.("Keine Sprache erkannt – ich höre weiter zu.");
        return;
      }
      if (code === "aborted") return;
      const message =
        code === "not-allowed" || code === "service-not-allowed"
          ? "Mikrofonzugriff wurde nicht erlaubt. Prüfe die Browser-Berechtigung und starte das Gespräch erneut."
          : code === "audio-capture"
            ? "Kein verwendbares Mikrofon gefunden. Prüfe dein Gerät und starte das Gespräch erneut."
            : "Die Spracherkennung ist fehlgeschlagen. Nutze bitte die Diktierfunktion oder den Textchat.";
      this.fail(message);
    };

    recognition.onend = () => {
      if (!this.isCurrentSession(session) || this.recognition !== recognition) return;
      this.recognition = null;
      if (this.pendingFinals.length && this.phase === "listening") {
        this.finalizeTurn(session);
        return;
      }
      if (this.phase === "listening" || this.phase === "speaking")
        this.scheduleRecognitionRestart(session);
    };

    try {
      recognition.start();
    } catch {
      if (this.recognition === recognition) this.recognition = null;
      this.fail(
        "Das Mikrofon konnte nicht gestartet werden. Prüfe die Berechtigung und versuche es erneut.",
      );
    }
  }

  private scheduleRecognitionRestart(session: number): void {
    if (this.restartTimer !== null) clearTimeout(this.restartTimer);
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      if (
        !this.isCurrentSession(session) ||
        (this.phase !== "listening" && this.phase !== "speaking")
      )
        return;
      this.startRecognition(session);
    }, RECOGNITION_RESTART_MS);
  }

  private scheduleFinalize(session: number): void {
    if (this.finalTimer !== null) clearTimeout(this.finalTimer);
    this.finalTimer = setTimeout(() => {
      this.finalTimer = null;
      this.finalizeTurn(session);
    }, END_OF_UTTERANCE_MS);
  }

  private finalizeTurn(session: number): void {
    if (!this.isCurrentSession(session) || this.phase !== "listening" || !this.pendingFinals.length)
      return;
    if (this.finalTimer !== null) clearTimeout(this.finalTimer);
    this.finalTimer = null;
    if (this.restartTimer !== null) clearTimeout(this.restartTimer);
    this.restartTimer = null;

    const transcript = joinTranscript(this.pendingFinals);
    this.pendingFinals = [];
    if (!transcript) return;
    this.options.onTranscriptChange?.(transcript);
    this.stopRecognition();
    this.setPhase("thinking");

    void Promise.resolve()
      .then(() => this.options.sendTranscript(transcript))
      .then((reply) => {
        if (!this.isCurrentSession(session) || this.phase !== "thinking") return;
        if (!reply?.trim()) {
          this.fail(
            "Mira konnte keine Antwort erstellen. Prüfe den Anbieter oder nutze den Textchat.",
          );
          return;
        }
        this.speak(reply, session);
      })
      .catch(() => {
        if (this.isCurrentSession(session))
          this.fail(
            "Miras Antwort konnte nicht vorgelesen werden. Prüfe den Anbieter oder nutze den Textchat.",
          );
      });
  }

  private speak(reply: string, session: number): void {
    const synthesis = this.options.speechSynthesis;
    const text = prepareMiraSpeechText(reply);
    if (!synthesis || !text) {
      this.fail("Miras Antwort enthält keinen vorlesbaren Text. Nutze bitte den Textchat.");
      return;
    }

    let utterance: MiraSpeechUtteranceLike;
    try {
      utterance = this.options.createUtterance(text);
      const settings = getMiraSpeechSettings(synthesis.getVoices());
      utterance.lang = settings.lang;
      utterance.rate = settings.rate;
      utterance.pitch = settings.pitch;
      utterance.volume = settings.volume;
      utterance.voice = settings.voice;
    } catch {
      this.fail("Miras Sprachausgabe konnte nicht vorbereitet werden. Nutze bitte den Textchat.");
      return;
    }

    this.utterance = utterance;
    this.spokenText = text;
    this.setPhase("speaking");
    const finish = (error?: string) => {
      if (this.utterance !== utterance || !this.isCurrentSession(session)) return;
      this.utterance = null;
      this.spokenText = "";
      if (error)
        this.options.onErrorChange?.("Die Sprachausgabe wurde unterbrochen; ich höre weiter zu.");
      else this.options.onErrorChange?.(null);
      this.setPhase("listening");
      if (!this.recognition) this.startRecognition(session);
    };
    utterance.onend = () => finish();
    utterance.onerror = () => finish("speech-error");

    try {
      synthesis.resume?.();
      synthesis.speak(utterance);
      if (!this.recognition) this.startRecognition(session);
    } catch {
      finish("speech-error");
    }
  }

  private stopRecognition(): void {
    const recognition = this.recognition;
    this.recognition = null;
    if (!recognition) return;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    try {
      if (recognition.abort) recognition.abort();
      else recognition.stop();
    } catch {
      /* A browser may already have ended the recognition instance. */
    }
  }

  private cancelSpeech(): void {
    const utterance = this.utterance;
    this.utterance = null;
    if (!utterance) return;
    utterance.onend = null;
    utterance.onerror = null;
    this.spokenText = "";
    try {
      this.options.speechSynthesis?.cancel();
    } catch {
      /* Speech cancellation is best-effort in browser implementations. */
    }
  }

  private clearTimers(): void {
    if (this.restartTimer !== null) clearTimeout(this.restartTimer);
    if (this.finalTimer !== null) clearTimeout(this.finalTimer);
    this.restartTimer = null;
    this.finalTimer = null;
  }

  private fail(message: string): void {
    this.active = false;
    this.session += 1;
    this.clearTimers();
    this.pendingFinals = [];
    this.stopRecognition();
    this.cancelSpeech();
    this.spokenText = "";
    this.setPhase("error");
    this.options.onErrorChange?.(message);
  }
}

export function createBrowserSpeechRecognitionFactory():
  (() => MiraSpeechRecognitionLike | null) | null {
  if (typeof window === "undefined") return null;
  const browser = window as unknown as {
    SpeechRecognition?: new () => MiraSpeechRecognitionLike;
    webkitSpeechRecognition?: new () => MiraSpeechRecognitionLike;
  };
  const Constructor = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
  return Constructor ? () => new Constructor() : null;
}
