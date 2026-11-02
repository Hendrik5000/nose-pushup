export type MiraVoiceOption = Pick<SpeechSynthesisVoice, "lang">;

export type MiraSpeechSettings = {
  lang: string;
  rate: number;
  pitch: number;
  volume: number;
  voice: MiraVoiceOption | null;
};

/** Remove common Markdown decoration so the device voice reads the answer naturally. */
export function prepareMiraSpeechText(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/https?:\/\/\S+/g, "Link")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Prefer a German system voice and speak a little more slowly; the actual voice is device-dependent. */
export function getMiraSpeechSettings(voices: readonly MiraVoiceOption[]): MiraSpeechSettings {
  const voice =
    voices.find((candidate) => candidate.lang.toLowerCase() === "de-de") ??
    voices.find((candidate) => candidate.lang.toLowerCase().startsWith("de-")) ??
    null;
  return { lang: "de-DE", rate: 0.9, pitch: 0.98, volume: 0.92, voice };
}
