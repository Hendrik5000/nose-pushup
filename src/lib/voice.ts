// ─── Voice Cues (Web Speech API) ─────────────────────────────────────────────
// German coaching cues during workouts. Respects the existing sound preference.

import { isSoundEnabled } from "./feedback";

const VOICE_KEY = "np-voice";

export function isVoiceEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const v = window.localStorage.getItem(VOICE_KEY);
  // Default off until user opts in (browsers often block autoplay TTS)
  return v === "1";
}

export function setVoiceEnabled(on: boolean) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(VOICE_KEY, on ? "1" : "0");
  }
}

let lastSpeak = 0;

/** Speak a short German cue. Debounced and gated by voice + sound prefs. */
export function speak(text: string, opts?: { force?: boolean; rate?: number }) {
  if (typeof window === "undefined") return;
  if (!opts?.force && !isVoiceEnabled()) return;
  if (!isSoundEnabled() && !opts?.force) return;
  if (!("speechSynthesis" in window)) return;

  const now = Date.now();
  if (!opts?.force && now - lastSpeak < 900) return;
  lastSpeak = now;

  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "de-DE";
    u.rate = opts?.rate ?? 1.05;
    u.pitch = 1;
    u.volume = 0.9;
    // Prefer a German voice if available
    const voices = window.speechSynthesis.getVoices();
    const de = voices.find((v) => v.lang.startsWith("de"));
    if (de) u.voice = de;
    window.speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}

export function speakRep(count: number) {
  if (count > 0 && count % 10 === 0) speak(`${count}`);
}

export function speakCue(cue: string | null | undefined) {
  if (!cue) return;
  speak(cue);
}

export function speakCountdown(n: number) {
  if (n <= 0) speak("Los!");
  else speak(String(n), { rate: 1.15 });
}
