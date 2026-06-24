import { useCallback, useEffect, useRef, useState } from "react";
import { getConfig, type DetectionType } from "@/lib/exercises";

type Args = {
  exerciseId: string;
  detection: DetectionType;
  active: boolean;
  onTick?: (n: number) => void;
};

/**
 * Unified counter engine.
 * - touch / combo: increments come from a UI tap (call `bump()` from onPointerDown).
 * - motion_vertical: increments come from devicemotion. Caller still wires `bump`
 *   for testing/manual fallback.
 * - timer: increments once per second while active.
 */
export function useExerciseEngine({ exerciseId, detection, active, onTick }: Args) {
  const cfg = getConfig(exerciseId);
  const [count, setCount] = useState(0);
  const [pop, setPop] = useState(0);
  const lastBump = useRef(0);
  const motionState = useRef<{ phase: "up" | "down"; peak: number }>({ phase: "up", peak: 0 });

  const bump = useCallback(() => {
    const now = Date.now();
    if (now - lastBump.current < cfg.minIntervalMs) return;
    lastBump.current = now;
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(35);
    setCount((c) => {
      const next = c + 1;
      onTick?.(next);
      return next;
    });
    setPop((p) => p + 1);
  }, [cfg.minIntervalMs, onTick]);

  // Timer-based exercises (plank): tick once per second.
  useEffect(() => {
    if (!active || detection !== "timer") return;
    const id = setInterval(() => bump(), 1000);
    return () => clearInterval(id);
  }, [active, detection, bump]);

  // Motion-based exercises (squat, burpee jump phase).
  useEffect(() => {
    if (!active || (detection !== "motion_vertical" && detection !== "combo")) return;
    const threshold = cfg.motionThreshold ?? 3.0;

    const handler = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity;
      if (!a || a.y == null) return;
      // Detect down -> up cycle on Y axis (gravity-adjusted).
      const y = a.y;
      const s = motionState.current;
      if (s.phase === "up" && y < -threshold) {
        s.phase = "down";
      } else if (s.phase === "down" && y > threshold) {
        s.phase = "up";
        bump();
      }
    };
    window.addEventListener("devicemotion", handler);
    return () => window.removeEventListener("devicemotion", handler);
  }, [active, detection, cfg.motionThreshold, bump]);

  const reset = useCallback(() => {
    setCount(0);
    setPop(0);
    lastBump.current = 0;
    motionState.current = { phase: "up", peak: 0 };
  }, []);

  return { count, pop, bump, reset };
}

/**
 * iOS Safari requires an explicit permission grant for DeviceMotion.
 * Call from a user gesture (e.g. on "Start" tap).
 */
export async function ensureMotionPermission(): Promise<boolean> {
  if (typeof DeviceMotionEvent === "undefined") return false;
  const anyEvt = DeviceMotionEvent as unknown as {
    requestPermission?: () => Promise<"granted" | "denied">;
  };
  if (typeof anyEvt.requestPermission !== "function") return true;
  try {
    const res = await anyEvt.requestPermission();
    return res === "granted";
  } catch {
    return false;
  }
}
