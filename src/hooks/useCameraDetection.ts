import { useCallback, useEffect, useRef, useState } from "react";

type Args = {
  active: boolean;
  onRep: () => void;
  minIntervalMs?: number;
};

/**
 * Lightweight camera-based push-up detector (MVP).
 * Approach: sample the bottom band of the camera frame and measure
 * mean brightness. A push-up cycle = brightness goes dark (face/phone close)
 * then bright again. We count one rep per dark→bright transition.
 *
 * No ML model, no extra dependencies — runs fully offline.
 */
export function useCameraDetection({ active, onRep, minIntervalMs = 350 }: Args) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastRepRef = useRef(0);
  const phaseRef = useRef<"bright" | "dark">("bright");
  const baselineRef = useRef<number | null>(null);
  const [brightness, setBrightness] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setReady(false);
  }, []);

  useEffect(() => {
    if (!active) {
      stop();
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 320, height: 240 },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setReady(true);

        const canvas = canvasRef.current ?? document.createElement("canvas");
        canvasRef.current = canvas;
        canvas.width = 64;
        canvas.height = 48;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;

        const sample = () => {
          if (!video || video.readyState < 2) {
            rafRef.current = requestAnimationFrame(sample);
            return;
          }
          // Draw lower third of the frame (where the user's face appears
          // when looking down at the phone during a push-up).
          ctx.drawImage(video, 0, video.videoHeight * 0.5, video.videoWidth, video.videoHeight * 0.5, 0, 0, 64, 48);
          const { data } = ctx.getImageData(0, 0, 64, 48);
          let sum = 0;
          for (let i = 0; i < data.length; i += 4) {
            sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
          }
          const mean = sum / (data.length / 4);
          setBrightness(mean);

          if (baselineRef.current === null) baselineRef.current = mean;
          // Slow drift to adapt to lighting changes
          baselineRef.current = baselineRef.current * 0.98 + mean * 0.02;
          const base = baselineRef.current;
          const darkT = base * 0.7;
          const brightT = base * 0.92;

          const now = Date.now();
          if (phaseRef.current === "bright" && mean < darkT) {
            phaseRef.current = "dark";
          } else if (phaseRef.current === "dark" && mean > brightT) {
            phaseRef.current = "bright";
            if (now - lastRepRef.current >= minIntervalMs) {
              lastRepRef.current = now;
              onRep();
            }
          }
          rafRef.current = requestAnimationFrame(sample);
        };
        rafRef.current = requestAnimationFrame(sample);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Kamera nicht verfügbar");
      }
    })();
    return () => {
      cancelled = true;
      stop();
    };
  }, [active, minIntervalMs, onRep, stop]);

  return { videoRef, brightness, error, ready };
}
