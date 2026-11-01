export const ALARM_RAMP_SECONDS = 45;
export const ALARM_START_GAIN = 0.12;
export const ALARM_MAX_GAIN = 0.55;

let audioContext: AudioContext | null = null;
let runId = 0;
let nextNoteTimer: number | null = null;
const activeOscillators = new Set<OscillatorNode>();

/** A gentle, bounded rise; non-overlapping notes leave ample digital headroom. */
export function alarmSoundPeak(elapsedSeconds: number, rampSeconds = ALARM_RAMP_SECONDS) {
  const progress = Math.min(1, Math.max(0, elapsedSeconds) / Math.max(1, rampSeconds));
  return ALARM_START_GAIN + progress * (ALARM_MAX_GAIN - ALARM_START_GAIN);
}

function getAudioContext() {
  if (typeof window === "undefined") return null;
  const AudioContextConstructor =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) return null;
  audioContext ??= new AudioContextConstructor();
  return audioContext;
}

function clearActiveSound() {
  if (nextNoteTimer !== null && typeof window !== "undefined") {
    window.clearTimeout(nextNoteTimer);
    nextNoteTimer = null;
  }
  for (const oscillator of activeOscillators) {
    try {
      oscillator.stop();
    } catch {
      // An oscillator may already have reached its natural end.
    }
  }
  activeOscillators.clear();
}

export function stopAlarmSound() {
  runId += 1;
  clearActiveSound();
}

export async function primeAlarmAudio(): Promise<boolean> {
  const context = getAudioContext();
  if (!context) return false;
  try {
    if (context.state === "suspended") await context.resume();
    return context.state === "running";
  } catch {
    return false;
  }
}

export async function startAlarmSound(rampSeconds = ALARM_RAMP_SECONDS): Promise<number | null> {
  stopAlarmSound();
  const thisRun = runId;
  const context = getAudioContext();
  if (!context) return null;

  try {
    if (context.state === "suspended") await context.resume();
  } catch {
    return null;
  }
  if (thisRun !== runId || context.state !== "running") return null;

  const notes = [523.25, 659.25, 783.99, 659.25, 587.33, 698.46];
  let step = 0;
  const playNext = () => {
    if (thisRun !== runId || context.state !== "running") return;
    const now = context.currentTime;
    const elapsedSeconds = (Date.now() - startedAt) / 1000;
    const swell = Math.min(1, Math.max(0, elapsedSeconds) / Math.max(1, rampSeconds));
    const peak = alarmSoundPeak(elapsedSeconds, rampSeconds);

    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    // A rounded, richer tone is easier to hear on phone speakers than a quiet sine.
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(notes[step % notes.length], now);
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.linearRampToValueAtTime(peak, now + 0.1);
    envelope.gain.setValueAtTime(peak, now + 0.35);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
    oscillator.connect(envelope).connect(context.destination);
    activeOscillators.add(oscillator);
    oscillator.addEventListener(
      "ended",
      () => {
        activeOscillators.delete(oscillator);
        oscillator.disconnect();
        envelope.disconnect();
      },
      { once: true },
    );
    oscillator.start(now);
    oscillator.stop(now + 0.9);

    step += 1;
    nextNoteTimer = window.setTimeout(playNext, 1300 - swell * 350);
  };
  const startedAt = Date.now();
  playNext();
  return thisRun;
}

export async function previewAlarmSound(durationMs = 9_000): Promise<(() => void) | null> {
  // Demonstrate the full rise during the short test, not only its quiet beginning.
  const thisRun = await startAlarmSound(Math.min(ALARM_RAMP_SECONDS, durationMs / 1000 - 1));
  if (thisRun === null) return null;
  const timer = window.setTimeout(() => {
    if (runId === thisRun) stopAlarmSound();
  }, durationMs);
  return () => {
    window.clearTimeout(timer);
    if (runId === thisRun) stopAlarmSound();
  };
}
