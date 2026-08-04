// Sound- und Vibrations-Feedback. Töne werden im Browser erzeugt (Web Audio API),
// es werden keine Audiodateien geladen.

const SOUND_KEY = "np-sound";
const HAPTICS_KEY = "np-haptics";

let ctx: AudioContext | null = null;

function readFlag(key: string): boolean {
  if (typeof window === "undefined") return true;
  const v = window.localStorage.getItem(key);
  return v === null ? true : v === "1";
}

export function isSoundEnabled() {
  return readFlag(SOUND_KEY);
}

export function isHapticsEnabled() {
  return readFlag(HAPTICS_KEY);
}

export function setSoundEnabled(on: boolean) {
  if (typeof window !== "undefined") window.localStorage.setItem(SOUND_KEY, on ? "1" : "0");
}

export function setHapticsEnabled(on: boolean) {
  if (typeof window !== "undefined") window.localStorage.setItem(HAPTICS_KEY, on ? "1" : "0");
}

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

type ToneOpts = {
  freq: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
  slideTo?: number;
};

function tone({ freq, duration, type = "sine", gain = 0.12, delay = 0, slideTo }: ToneOpts) {
  const audio = getCtx();
  if (!audio) return;
  const start = audio.currentTime + delay;
  const osc = audio.createOscillator();
  const vol = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
  vol.gain.setValueAtTime(0.0001, start);
  vol.gain.exponentialRampToValueAtTime(gain, start + 0.012);
  vol.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(vol).connect(audio.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

function vibrate(pattern: number | number[]) {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  if (!isHapticsEnabled()) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* ignore */
  }
}

/** Kurzer Klick bei jeder Wiederholung. */
export function feedbackRep(count?: number) {
  if (isSoundEnabled()) {
    // Jede 10. Wiederholung klingt etwas höher – hörbarer Meilenstein.
    const milestone = count != null && count % 10 === 0;
    tone({ freq: milestone ? 880 : 620, duration: 0.07, type: "square", gain: 0.07 });
  }
  vibrate(count != null && count % 10 === 0 ? [18, 40, 18] : 14);
}

/** Level-Up-Fanfare. */
export function feedbackLevelUp() {
  if (isSoundEnabled()) {
    tone({ freq: 523, duration: 0.14, type: "triangle" });
    tone({ freq: 659, duration: 0.14, type: "triangle", delay: 0.12 });
    tone({ freq: 784, duration: 0.3, type: "triangle", delay: 0.24 });
  }
  vibrate([30, 50, 30, 50, 80]);
}

/** Battle gewonnen. */
export function feedbackWin() {
  if (isSoundEnabled()) {
    tone({ freq: 440, duration: 0.12, type: "sawtooth", gain: 0.09 });
    tone({ freq: 660, duration: 0.12, type: "sawtooth", gain: 0.09, delay: 0.1 });
    tone({ freq: 880, duration: 0.35, type: "sawtooth", gain: 0.09, delay: 0.2 });
  }
  vibrate([40, 60, 120]);
}

/** Battle verloren / Ziel verfehlt. */
export function feedbackLose() {
  if (isSoundEnabled()) {
    tone({ freq: 320, duration: 0.35, type: "sine", gain: 0.08, slideTo: 140 });
  }
  vibrate([120]);
}

/** Streak gerettet / Ziel erreicht. */
export function feedbackSuccess() {
  if (isSoundEnabled()) {
    tone({ freq: 700, duration: 0.1, type: "sine" });
    tone({ freq: 1050, duration: 0.22, type: "sine", delay: 0.09 });
  }
  vibrate([25, 40, 25]);
}
