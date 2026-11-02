export type MiraVoiceOption = Pick<SpeechSynthesisVoice, "lang" | "default"> &
  Partial<Pick<SpeechSynthesisVoice, "name">>;

export type MiraSpeechSettings = {
  lang: string;
  rate: number;
  pitch: number;
  volume: number;
  voice: MiraVoiceOption | null;
};

export type MiraSpeechPrimerUtterance = Pick<SpeechSynthesisUtterance, "volume" | "rate">;
export type MiraSpeechPrimerEngine = {
  speak: (utterance: MiraSpeechPrimerUtterance) => void;
  resume?: () => void;
};

/** Prime iOS Safari's speech output inside the user's explicit start gesture without audible text. */
export function primeMiraSpeechForUserGesture(
  engine: MiraSpeechPrimerEngine,
  createUtterance: (text: string) => MiraSpeechPrimerUtterance,
): void {
  const silentUtterance = createUtterance(" ");
  silentUtterance.volume = 0;
  silentUtterance.rate = 10;
  engine.speak(silentUtterance);
  engine.resume?.();
}

function addPause(line: string): string {
  const trimmed = line.trim();
  return /[.!?…:]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

/** Remove common Markdown decoration and preserve natural pauses for the device voice. */
export function prepareMiraSpeechText(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+(.+)$/gm, (_match, line: string) => addPause(line))
    .replace(/^\s*[-*+]\s+(.+)$/gm, (_match, line: string) => addPause(line))
    .replace(/^\s*\d+\.\s+(.+)$/gm, (_match, line: string) => addPause(line))
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/https?:\/\/\S+/g, "Link")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Prefer the user's default German system voice and avoid an overly slow, flat delivery. */
export function getMiraSpeechSettings(voices: readonly MiraVoiceOption[]): MiraSpeechSettings {
  const germanVoices = voices.filter((candidate) => candidate.lang.toLowerCase().startsWith("de-"));
  const voice =
    germanVoices.find((candidate) => candidate.default) ??
    germanVoices.find((candidate) => candidate.lang.toLowerCase() === "de-de") ??
    germanVoices[0] ??
    null;
  return { lang: "de-DE", rate: 0.97, pitch: 1, volume: 0.96, voice };
}

/** Identify a likely acoustic loopback before it can interrupt the device's own speech. */
export function isLikelyMiraSpeechEcho(transcript: string, spokenText: string): boolean {
  const normalize = (value: string) =>
    value
      .toLocaleLowerCase("de-DE")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim()
      .replace(/\s+/g, " ");
  const heardWords = normalize(transcript).split(" ").filter(Boolean);
  const spokenWords = normalize(spokenText).split(" ").filter(Boolean);
  if (heardWords.length === 1 && ["halt", "stop", "stopp", "warte"].includes(heardWords[0])) {
    return false;
  }
  if (!heardWords.length || spokenWords.length < heardWords.length) return false;

  for (let start = 0; start <= spokenWords.length - heardWords.length; start += 1) {
    if (spokenWords.slice(start, start + heardWords.length).join(" ") === heardWords.join(" ")) {
      return true;
    }
  }
  return false;
}

/** Let clear user speech interrupt playback, including a short spoken stop command. */
export function isMiraVoiceInterruption(transcript: string): boolean {
  const words = transcript
    .toLocaleLowerCase("de-DE")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/u)
    .filter(Boolean);
  return (
    words.length >= 2 ||
    (words.length === 1 && ["halt", "stop", "stopp", "warte"].includes(words[0]))
  );
}

/** Prefer final recognition; use a meaningful interim result if the browser omits final output. */
export function resolveMiraVoiceTurnTranscript(
  finalTranscript: string,
  interimTranscript: string,
): string {
  const finalized = finalTranscript.trim();
  if (finalized) return finalized;

  const interim = interimTranscript.trim();
  return isMiraVoiceInterruption(interim) ? interim : "";
}
