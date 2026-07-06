import { useCallback, useEffect, useRef, useState } from "react";
import type { PoseLandmarker } from "@mediapipe/tasks-vision";

type Args = {
  active: boolean;
  onRep: () => void;
  minIntervalMs?: number;
};

/**
 * AI camera-based push-up detector using MediaPipe Pose Landmarker.
 * Tracks the vertical position of the shoulders (avg of left/right shoulder Y).
 * A push-up cycle = shoulders move down (chest closer to floor) then up again.
 * We count one rep per down→up transition.
 */
export function useCameraDetection({ active, onRep, minIntervalMs = 600 }: Args) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const lastRepRef = useRef(0);
  const phaseRef = useRef<"up" | "down">("up");
  const baselineRef = useRef<number | null>(null);
  const minYRef = useRef<number>(1);
  const maxYRef = useRef<number>(0);
  const onRepRef = useRef(onRep);
  const minIntervalRef = useRef(minIntervalMs);
  useEffect(() => {
    onRepRef.current = onRep;
    minIntervalRef.current = minIntervalMs;
  }, [onRep, minIntervalMs]);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<string>("Modell wird geladen…");

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (landmarkerRef.current) {
      landmarkerRef.current.close();
      landmarkerRef.current = null;
    }
    baselineRef.current = null;
    minYRef.current = 1;
    maxYRef.current = 0;
    phaseRef.current = "up";
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
        setStatus("KI-Modell wird geladen…");
        const vision = await import("@mediapipe/tasks-vision");
        const fileset = await vision.FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm",
        );
        if (cancelled) return;
        const landmarker = await vision.PoseLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numPoses: 1,
        });
        if (cancelled) {
          landmarker.close();
          return;
        }
        landmarkerRef.current = landmarker;

        setStatus("Frontkamera wird geöffnet…");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 480, height: 360 },
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
        setStatus("Positioniere dich für Push-Ups");

        const sample = () => {
          const l = landmarkerRef.current;
          if (!video || !l || video.readyState < 2) {
            rafRef.current = requestAnimationFrame(sample);
            return;
          }
          const ts = performance.now();
          const result = l.detectForVideo(video, ts);
          const lm = result.landmarks?.[0];
          if (lm && lm.length > 12) {
            // 11 = left shoulder, 12 = right shoulder. Y is normalized 0(top)-1(bottom).
            const ls = lm[11];
            const rs = lm[12];
            if (ls && rs && ls.visibility! > 0.5 && rs.visibility! > 0.5) {
              const y = (ls.y + rs.y) / 2;

              // Track observed range to auto-calibrate threshold.
              if (y < minYRef.current) minYRef.current = y;
              if (y > maxYRef.current) maxYRef.current = y;
              const range = maxYRef.current - minYRef.current;

              // Need at least 8% frame-height of movement before counting.
              if (range > 0.08) {
                const downT = minYRef.current + range * 0.7; // near the floor
                const upT = minYRef.current + range * 0.3; // near the top
                const now = Date.now();
                if (phaseRef.current === "up" && y > downT) {
                  phaseRef.current = "down";
                  setStatus("↓ unten");
                } else if (phaseRef.current === "down" && y < upT) {
                  phaseRef.current = "up";
                  setStatus("↑ oben");
                  if (now - lastRepRef.current >= minIntervalMs) {
                    lastRepRef.current = now;
                    onRep();
                  }
                }
              } else {
                setStatus("Bewege dich für Kalibrierung");
              }
            } else {
              setStatus("Schultern nicht sichtbar");
            }
          } else {
            setStatus("Suche Körper…");
          }
          rafRef.current = requestAnimationFrame(sample);
        };
        rafRef.current = requestAnimationFrame(sample);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Kamera oder KI nicht verfügbar");
      }
    })();
    return () => {
      cancelled = true;
      stop();
    };
  }, [active, minIntervalMs, onRep, stop]);

  return { videoRef, error, ready, status };
}
