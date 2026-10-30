/** Simple two-tone ringtone built with WebAudio, so no audio asset is needed. */
export type Ringtone = { stop: () => void };

export function startRingtone(): Ringtone {
  let stopped = false;
  let ctx: AudioContext | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  try {
    const Ctor = (window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) as
      typeof AudioContext | undefined;
    if (Ctor) {
      ctx = new Ctor();
      const audio = ctx;
      const beep = (frequency: number, start: number, length: number) => {
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        osc.type = "sine";
        osc.frequency.value = frequency;
        gain.gain.setValueAtTime(0, audio.currentTime + start);
        gain.gain.linearRampToValueAtTime(0.18, audio.currentTime + start + 0.03);
        gain.gain.linearRampToValueAtTime(0, audio.currentTime + start + length);
        osc.connect(gain).connect(audio.destination);
        osc.start(audio.currentTime + start);
        osc.stop(audio.currentTime + start + length + 0.05);
      };
      const ring = () => {
        if (stopped || audio.state === "closed") return;
        void audio.resume().catch(() => undefined);
        beep(440, 0, 0.35);
        beep(520, 0.45, 0.35);
        if ("vibrate" in navigator) navigator.vibrate?.([300, 150, 300]);
      };
      ring();
      timer = setInterval(ring, 2500);
    }
  } catch {
    // Audio can be blocked until the user interacts with the page; the visual dialog still works.
  }
  return {
    stop() {
      stopped = true;
      if (timer) clearInterval(timer);
      if ("vibrate" in navigator) navigator.vibrate?.(0);
      void ctx?.close().catch(() => undefined);
    },
  };
}
