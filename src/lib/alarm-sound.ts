let audioContext: AudioContext | null = null;
let runId = 0;
let nextNoteTimer: number | null = null;
const activeOscillators = new Set<OscillatorNode>();

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

export async function startAlarmSound(): Promise<number | null> {
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
    const swell = Math.min(1, elapsedSeconds / 180);
    const peak = 0.045 + swell * 0.09;
    const frequency = notes[step % notes.length] * (elapsedSeconds > 90 ? 1.04 : 1);

    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, now);
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(peak, now + 0.06);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + 0.72);
    oscillator.connect(envelope).connect(context.destination);
    activeOscillators.add(oscillator);
    oscillator.addEventListener("ended", () => activeOscillators.delete(oscillator), {
      once: true,
    });
    oscillator.start(now);
    oscillator.stop(now + 0.75);

    step += 1;
    nextNoteTimer = window.setTimeout(playNext, Math.max(850, 1350 - swell * 300));
  };
  const startedAt = Date.now();
  playNext();
  return thisRun;
}

export async function previewAlarmSound(durationMs = 9_000): Promise<(() => void) | null> {
  const thisRun = await startAlarmSound();
  if (thisRun === null) return null;
  const timer = window.setTimeout(() => {
    if (runId === thisRun) stopAlarmSound();
  }, durationMs);
  return () => {
    window.clearTimeout(timer);
    if (runId === thisRun) stopAlarmSound();
  };
}
