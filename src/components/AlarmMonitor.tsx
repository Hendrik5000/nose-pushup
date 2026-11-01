import { useCallback, useEffect, useRef, useState } from "react";
import { AlarmClock, Bell, Moon } from "lucide-react";
import {
  ALARM_SETTINGS_EVENT,
  getDueAlarm,
  readAlarmSettings,
  saveAlarmSettings,
} from "@/lib/alarm";
import { startAlarmSound, stopAlarmSound } from "@/lib/alarm-sound";
import { showNotification } from "@/lib/notifications";

export function AlarmMonitor({ userId }: { userId: string }) {
  const [ringing, setRinging] = useState(false);
  const ringingRef = useRef(false);
  const [ringingSince, setRingingSince] = useState("");

  const silence = useCallback(() => {
    stopAlarmSound();
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(0);
    ringingRef.current = false;
    setRinging(false);
  }, []);

  useEffect(() => {
    const checkAlarm = () => {
      const settings = readAlarmSettings(userId);
      if (!settings.enabled) {
        if (ringingRef.current) silence();
        return;
      }
      const dueToken = getDueAlarm(settings, new Date());
      if (!dueToken || ringingRef.current) return;

      ringingRef.current = true;
      setRinging(true);
      setRingingSince(
        new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }),
      );
      saveAlarmSettings(userId, {
        ...settings,
        lastTriggeredFor: dueToken,
        ...(dueToken.startsWith("snooze:") ? { snoozeUntil: undefined } : {}),
      });
      void startAlarmSound().catch(() => undefined);
      if (typeof navigator !== "undefined" && "vibrate" in navigator)
        navigator.vibrate([300, 120, 300, 120, 520]);
      void showNotification(
        "Alo-Wecker",
        "Guten Morgen — dein sanfter Weckton läuft.",
        "alo-alarm",
        "/alarm",
      ).catch(() => undefined);
    };

    checkAlarm();
    const timer = window.setInterval(checkAlarm, 10_000);
    window.addEventListener(ALARM_SETTINGS_EVENT, checkAlarm);
    window.addEventListener("storage", checkAlarm);
    document.addEventListener("visibilitychange", checkAlarm);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(ALARM_SETTINGS_EVENT, checkAlarm);
      window.removeEventListener("storage", checkAlarm);
      document.removeEventListener("visibilitychange", checkAlarm);
      silence();
    };
  }, [silence, userId]);

  const snooze = () => {
    const settings = readAlarmSettings(userId);
    saveAlarmSettings(userId, {
      ...settings,
      snoozeUntil: new Date(Date.now() + 5 * 60_000).toISOString(),
    });
    silence();
  };

  if (!ringing) return null;
  return (
    <section
      role="alert"
      aria-live="assertive"
      aria-labelledby="alo-alarm-alert-title"
      className="fixed inset-x-3 bottom-4 z-[120] mx-auto max-w-lg rounded-3xl border border-primary/40 bg-card p-5 text-card-foreground shadow-2xl sm:bottom-6 sm:p-6"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <AlarmClock className="h-6 w-6" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            Alo-Wecker · {ringingSince}
          </p>
          <h2 id="alo-alarm-alert-title" className="mt-1 text-lg font-bold">
            Guten Morgen — Zeit aufzustehen.
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Der sanft ansteigende Weckton läuft.</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={snooze}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-3 py-2 text-sm font-semibold text-foreground"
        >
          <Moon className="h-4 w-4" aria-hidden="true" /> 5 Min. schlummern
        </button>
        <button
          type="button"
          onClick={silence}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
        >
          <Bell className="h-4 w-4" aria-hidden="true" /> Wecker ausschalten
        </button>
      </div>
    </section>
  );
}
