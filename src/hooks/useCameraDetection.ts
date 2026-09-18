import { useCallback, useEffect, useRef, useState } from "react";
import type { PoseLandmarker } from "@mediapipe/tasks-vision";

/** Bewertung einer einzelnen Wiederholung. */
export type RepQuality = {
  /** Note von 1 (schlecht) bis 5 (perfekt). */
  grade: number;
  /** true = volle Wiederholung, false = halbe (zu wenig Tiefe). */
  full: boolean;
  /** Kleinster Ellbogenwinkel während der Wiederholung. */
  depth: number;
  /** Abweichung der Hüftlinie in Grad (0 = perfekt gerade). */
  hipDeviation: number;
  /** Dauer der Wiederholung in Millisekunden. */
  tempoMs: number;
  /** Kurzer Hinweis für die Nutzerin/den Nutzer. */
  cue: string | null;
};

type Args = {
  active: boolean;
  onRep: (quality: RepQuality) => void;
  minIntervalMs?: number;
};

const DEPTH_GOOD = 90; // Ellbogenwinkel für volle Tiefe
const DEPTH_PARTIAL = 115; // ab hier zählt es als halbe Wiederholung
const UP_ANGLE = 155;
const TEMPO_FAST = 700; // schneller als das = gerissen
const TEMPO_SLOW = 4000;

/**
 * KI-Kamera-Erkennung für Push-Ups inkl. Form-Check.
 *
 * Bewertet pro Wiederholung Tiefe (Ellbogenwinkel), Hüftlinie
 * (Schulter–Hüfte–Knie) und Tempo und liefert eine Note von 1–5.
 * Läuft vollständig auf dem Gerät.
 */
export function useCameraDetection({ active, onRep, minIntervalMs = 600 }: Args) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const lastRepRef = useRef(0);

  // Phase tracking for elbow-angle method
  const phaseRef = useRef<"up" | "down">("up");
  const repStartRef = useRef(0);
  const minAngleRef = useRef(180);
  const hipSumRef = useRef(0);
  const hipCountRef = useRef(0);
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
  const [liveCue, setLiveCue] = useState<string | null>(null);
  const [lastQuality, setLastQuality] = useState<RepQuality | null>(null);

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
    minAngleRef.current = 180;
    hipSumRef.current = 0;
    hipCountRef.current = 0;
    setReady(false);
    setElbowAngle(null);
    setLiveCue(null);
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
            // 25=L-knee    26=R-knee
            const ls = lm[11], rs = lm[12];
            const le = lm[13], re = lm[14];
            const lw = lm[15], rw = lm[16];
            const lh = lm[23], rh = lm[24];
            const lk = lm[25], rk = lm[26];

            const leftVis =
              (ls?.visibility ?? 0) > 0.5 &&
              (le?.visibility ?? 0) > 0.5 &&
              (lw?.visibility ?? 0) > 0.5;
            const rightVis =
              (rs?.visibility ?? 0) > 0.5 &&
              (re?.visibility ?? 0) > 0.5 &&
              (rw?.visibility ?? 0) > 0.5;

            // Hüftlinie: Schulter–Hüfte–Knie sollte ~180° sein.
            let hipAngle: number | null = null;
            {
              let sum = 0, cnt = 0;
              if (ls && lh && lk && (lh.visibility ?? 0) > 0.5 && (lk.visibility ?? 0) > 0.5) {
                sum += calcAngle(ls, lh, lk); cnt++;
              }
              if (rs && rh && rk && (rh.visibility ?? 0) > 0.5 && (rk.visibility ?? 0) > 0.5) {
                sum += calcAngle(rs, rh, rk); cnt++;
              }
              if (cnt > 0) hipAngle = sum / cnt;
            }

            if (leftVis || rightVis) {
              let sum = 0, cnt = 0;
              if (leftVis && ls && le && lw) { sum += calcAngle(ls, le, lw); cnt++; }
              if (rightVis && rs && re && rw) { sum += calcAngle(rs, re, rw); cnt++; }
              const angle = cnt > 0 ? sum / cnt : 180;

              setElbowAngle(Math.round(angle));
              const now = Date.now();

              if (phaseRef.current === "down") {
                if (angle < minAngleRef.current) minAngleRef.current = angle;
                if (hipAngle !== null) {
                  hipSumRef.current += Math.abs(180 - hipAngle);
                  hipCountRef.current++;
                }
              }

              // Rep-Logik: oben (≥155°) → unten (≤115°) → oben = 1 Wiederholung
              if (phaseRef.current === "up" && angle <= DEPTH_PARTIAL) {
                phaseRef.current = "down";
                repStartRef.current = now;
                minAngleRef.current = angle;
                hipSumRef.current = 0;
                hipCountRef.current = 0;
                setStatus(`↓ Runter · ${Math.round(angle)}°`);
              } else if (phaseRef.current === "down" && angle >= UP_ANGLE) {
                phaseRef.current = "up";
                setStatus(`↑ Oben · ${Math.round(angle)}°`);
                if (now - lastRepRef.current >= minIntervalRef.current) {
                  lastRepRef.current = now;
                  const depth = minAngleRef.current;
                  const hipDev =
                    hipCountRef.current > 0 ? hipSumRef.current / hipCountRef.current : 0;
                  const tempoMs = now - repStartRef.current;
                  const quality = gradeRep(depth, hipDev, tempoMs);
                  setLastQuality(quality);
                  setLiveCue(quality.cue);
                  onRepRef.current(quality);
                }
                minAngleRef.current = 180;
              } else {
                const phase = phaseRef.current === "up" ? "Strecken…" : "Runter…";
                setStatus(`${phase} ${Math.round(angle)}°`);
                // Live-Hinweise während der Bewegung
                if (phaseRef.current === "down" && hipAngle !== null && Math.abs(180 - hipAngle) > 22) {
                  setLiveCue(hipAngle < 180 ? "Hüfte hoch" : "Po runter");
                } else if (phaseRef.current === "down" && angle > DEPTH_PARTIAL - 5) {
                  setLiveCue("Tiefer");
                }
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
                    repStartRef.current = now;
                    setStatus("↓ Runter (Fallback)");
                  } else if (fallbackPhaseRef.current === "down" && y < upT) {
                    fallbackPhaseRef.current = "up";
                    setStatus("↑ Oben (Fallback)");
                    if (now - lastRepRef.current >= minIntervalRef.current) {
                      lastRepRef.current = now;
                      const quality: RepQuality = {
                        grade: 3,
                        full: true,
                        depth: 90,
                        hipDeviation: 0,
                        tempoMs: now - repStartRef.current,
                        cue: null,
                      };
                      setLastQuality(quality);
                      onRepRef.current(quality);
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

  return { videoRef, error, ready, status, elbowAngle, liveCue, lastQuality };
}

/** Bewertet eine Wiederholung anhand von Tiefe, Hüftlinie und Tempo. */
export function gradeRep(depth: number, hipDeviation: number, tempoMs: number): RepQuality {
  let grade = 5;
  let cue: string | null = null;

  if (depth > DEPTH_PARTIAL) {
    grade -= 2.5;
    cue = "Tiefer";
  } else if (depth > DEPTH_GOOD) {
    grade -= 1;
    cue = "Etwas tiefer";
  }

  if (hipDeviation > 30) {
    grade -= 1.5;
    cue = cue ?? "Hüfte auf einer Linie";
  } else if (hipDeviation > 18) {
    grade -= 0.75;
    cue = cue ?? "Rumpf anspannen";
  }

  if (tempoMs < TEMPO_FAST) {
    grade -= 1;
    cue = cue ?? "Langsamer";
  } else if (tempoMs > TEMPO_SLOW) {
    grade -= 0.5;
  }

  grade = Math.max(1, Math.min(5, Math.round(grade * 2) / 2));

  return {
    grade,
    full: depth <= DEPTH_GOOD + 10,
    depth: Math.round(depth),
    hipDeviation: Math.round(hipDeviation),
    tempoMs,
    cue,
  };
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
