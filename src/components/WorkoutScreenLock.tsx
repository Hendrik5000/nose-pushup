import { useEffect, useState } from "react";
import { readAccessibilityPreferences } from "@/lib/accessibility-preferences";

type WakeLockSentinelLike = {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: "release", listener: () => void) => void;
};

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: {
    request: (type: "screen") => Promise<WakeLockSentinelLike>;
  };
};

export function WorkoutScreenLock({ userId, active }: { userId: string | null; active: boolean }) {
  const [status, setStatus] = useState("");

  useEffect(() => {
    setStatus("");
    if (!userId || !active || !readAccessibilityPreferences(userId).keepScreenAwake) return;

    const api = (navigator as NavigatorWithWakeLock).wakeLock;
    if (!api) {
      setStatus("Bildschirm-Wachhalten wird von diesem Browser nicht unterstützt.");
      return;
    }

    let cancelled = false;
    let sentinel: WakeLockSentinelLike | null = null;
    const request = async () => {
      if (cancelled || document.visibilityState !== "visible" || sentinel?.released === false)
        return;
      try {
        const next = await api.request("screen");
        if (cancelled) {
          await next.release().catch(() => undefined);
          return;
        }
        sentinel = next;
        setStatus("Bildschirm bleibt während dieser aktiven Einheit wach.");
        next.addEventListener("release", () => {
          if (sentinel === next) sentinel = null;
        });
      } catch {
        setStatus("Bildschirm-Wachhalten wurde vom Gerät nicht zugelassen.");
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void request();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    void request();

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      const current = sentinel;
      sentinel = null;
      if (current && !current.released) void current.release().catch(() => undefined);
    };
  }, [active, userId]);

  return status ? (
    <p
      role="status"
      className="rounded-xl border border-border/70 bg-card/60 px-3 py-2 text-xs text-muted-foreground"
    >
      {status}
    </p>
  ) : null;
}
