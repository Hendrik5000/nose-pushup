import { useCallback, useEffect, useRef, useState } from "react";
import type { PoseLandmarker } from "@mediapipe/tasks-vision";

type Args = {
  active: boolean;
  onRep: () => void;
  minIntervalMs?: number;
};

/**
 * AI camera-based push-up detector using MediaPipe Pose Landmarker.
 *
 * Detection strategy: elbow angle (shoulder→elbow→wrist).
 * - Arms extended (top of push-up):  angle ≥ 155°
 * - Arms bent    (bottom of push-up): angle ≤ 85°
 * A rep is counted on the up→down→up transition.
 *
 * Improvement over shoulder-Y approach:
 * - Works regardless of camera placement angle.
 * - Not fooled by the whole body moving (e.g. rocking).
 * - Requires both elbows to be visible; falls back to shoulder-Y if only one visible.
 */
export function useCameraDetection({ active, onRep, minIntervalMs = 600 }: Args) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const lastRepRef = useRef(0);

  // Phase tracking for elbow-angle method
  const phaseRef = useRef<"up" | "down">("up");
  // For shoulder-Y fallback
  const minYRef = useRef<number>(1);
  const maxYRef = useRef<number>(0);
  const fallbackPhaseRef = useRef<"up" | "down">("up");

  const onRepRef = useRef(onRep);
  const minIntervalRef = useRef(minIntervalMs);
  useEffect(() => {
    onRepRef.current = onRep;
    minIntervalRef.current = minIntervalMs;
  }, [onRep, minIntervalMs]);

  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<string>("Modell wird geladen…");
  const [elbowAngle, setElbowAngle] = useState<number | null>(null);

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
    phaseRef.current = "up";
    fallbackPhaseRef.current = "up";
    minYRef.current = 1;
    maxYRef.current = 0;
    setReady(false);
    setElbowAngle(null);
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

        let landmarker: PoseLandmarker;
        try {
          landmarker = await vision.PoseLandmarker.createFromOptions(fileset, {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
              delegate: "GPU",
            },
            runningMode: "VIDEO",
            numPoses: 1,
          });
        } catch {
          landmarker = await vision.PoseLandmarker.createFromOptions(fileset, {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
              delegate: "CPU",
            },
            runningMode: "VIDEO",
            numPoses: 1,
          });
        }
        if (cancelled) { landmarker.close(); return; }
        landmarkerRef.current = landmarker;

        setStatus("Kamera wird geöffnet…");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 640, height: 480 },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;

        let attempts = 0;
        while (!videoRef.current && attempts < 50 && !cancelled) {
          await new Promise((r) => setTimeout(r, 50));
          attempts++;
        }
        const video = videoRef.current;
        if (!video || cancelled) return;
        video.srcObject = stream;
        await video.play();
        setReady(true);
        setStatus("Positioniere dich: Kamera seitlich aufstellen");

        const sample = () => {
          const l = landmarkerRef.current;
          if (!video || !l || video.readyState < 2) {
            rafRef.current = requestAnimationFrame(sample);
            return;
          }

          const ts = performance.now();
          const result = l.detectForVideo(video, ts);
          const lm = result.landmarks?.[0];

          if (lm && lm.length > 16) {
            // ── Landmark indices ──────────────────────────────────────────
            // 11=L-shoulder 12=R-shoulder 13=L-elbow 14=R-elbow
            // 15=L-wrist   16=R-wrist   23=L-hip   24=R-hip
            const ls = lm[11], rs = lm[12];
            const le = lm[13], re = lm[14];
            const lw = lm[15], rw = lm[16];

            const leftVis =
              (ls?.visibility ?? 0) > 0.5 &&
              (le?.visibility ?? 0) > 0.5 &&
              (lw?.visibility ?? 0) > 0.5;
            const rightVis =
              (rs?.visibility ?? 0) > 0.5 &&
              (re?.visibility ?? 0) > 0.5 &&
              (rw?.visibility ?? 0) > 0.5;

            if (leftVis || rightVis) {
              // Calculate elbow angle for whichever side(s) are visible
              let angle = 180;
              let angleCount = 0;
              if (leftVis && ls && le && lw) {
                angle += calcAngle(ls, le, lw);
                angleCount++;
              }
              if (rightVis && rs && re && rw) {
                angle += calcAngle(rs, re, rw);
                angleCount++;
              }
              if (angleCount > 0) angle = (angle - 180) / angleCount + 180; // average, keep sign
              // Redo: just average all valid angles
              let sum = 0, cnt = 0;
              if (leftVis && ls && le && lw) { sum += calcAngle(ls, le, lw); cnt++; }
              if (rightVis && rs && re && rw) { sum += calcAngle(rs, re, rw); cnt++; }
              angle = cnt > 0 ? sum / cnt : 180;

              setElbowAngle(Math.round(angle));
              const now = Date.now();

              // Rep logic: up (angle ≥ 155°) → down (angle ≤ 85°) → up = 1 rep
              if (phaseRef.current === "up" && angle <= 85) {
                phaseRef.current = "down";
                setStatus(`↓ Runter · ${Math.round(angle)}°`);
              } else if (phaseRef.current === "down" && angle >= 155) {
                phaseRef.current = "up";
                setStatus(`↑ Oben · ${Math.round(angle)}°`);
                if (now - lastRepRef.current >= minIntervalRef.current) {
                  lastRepRef.current = now;
                  onRepRef.current();
                }
              } else {
                const phase = phaseRef.current === "up" ? "Strecken…" : "Runter…";
                setStatus(`${phase} ${Math.round(angle)}°`);
              }
            } else {
              // Fallback: shoulder-Y (works for front-facing camera)
              const bothShoulders =
                ls && rs &&
                (ls.visibility ?? 0) > 0.5 &&
                (rs.visibility ?? 0) > 0.5;

              if (bothShoulders && ls && rs) {
                const y = (ls.y + rs.y) / 2;
                if (y < minYRef.current) minYRef.current = y;
                if (y > maxYRef.current) maxYRef.current = y;
                const range = maxYRef.current - minYRef.current;
                if (range > 0.06) {
                  const downT = minYRef.current + range * 0.65;
                  const upT = minYRef.current + range * 0.35;
                  const now = Date.now();
                  if (fallbackPhaseRef.current === "up" && y > downT) {
                    fallbackPhaseRef.current = "down";
                    setStatus("↓ Runter (Fallback)");
                  } else if (fallbackPhaseRef.current === "down" && y < upT) {
                    fallbackPhaseRef.current = "up";
                    setStatus("↑ Oben (Fallback)");
                    if (now - lastRepRef.current >= minIntervalRef.current) {
                      lastRepRef.current = now;
                      onRepRef.current();
                    }
                  } else {
                    setStatus("Schulter-Tracking (Kalibrierung)");
                  }
                } else {
                  setStatus("Kamera seitlich stellen für Winkel-Erkennung");
                }
              } else {
                setStatus("Körper nicht vollständig sichtbar");
              }
            }
          } else {
            setStatus("Suche Körper…");
          }

          rafRef.current = requestAnimationFrame(sample);
        };

        rafRef.current = requestAnimationFrame(sample);
      } catch (e) {
        console.error("[camera-detection]", e);
        setError(e instanceof Error ? e.message : "Kamera oder KI nicht verfügbar");
      }
    })();

    return () => {
      cancelled = true;
      stop();
    };
  }, [active, stop]);

  return { videoRef, error, ready, status, elbowAngle };
}

/** Calculate the angle at joint `b` between rays b→a and b→c (in degrees). */
function calcAngle(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
): number {
  const ba = { x: a.x - b.x, y: a.y - b.y };
  const bc = { x: c.x - b.x, y: c.y - b.y };
  const dot = ba.x * bc.x + ba.y * bc.y;
  const magBa = Math.sqrt(ba.x ** 2 + ba.y ** 2);
  const magBc = Math.sqrt(bc.x ** 2 + bc.y ** 2);
  if (magBa === 0 || magBc === 0) return 180;
  const cosTheta = Math.max(-1, Math.min(1, dot / (magBa * magBc)));
  return (Math.acos(cosTheta) * 180) / Math.PI;
}
