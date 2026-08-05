import { useEffect, useState } from "react";
import {
  DEFAULT_REMINDER_TIME,
  getReminderTime,
  isNotifyEnabled,
  notificationPermission,
  notificationsSupported,
  requestNotificationPermission,
  setNotifyEnabled,
  setReminderTime,
  showNotification,
} from "@/lib/notifications";

/** Einstellungen für tägliche Erinnerungen und Social-Hinweise. */
export function NotificationSettings() {
  const [supported, setSupported] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [time, setTime] = useState(DEFAULT_REMINDER_TIME);
  const [denied, setDenied] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setSupported(notificationsSupported());
    setEnabled(isNotifyEnabled());
    setTime(getReminderTime());
    setDenied(notificationPermission() === "denied");
  }, []);

  const toggle = async () => {
    if (enabled) {
      setEnabled(false);
      setNotifyEnabled(false);
      setMessage("Benachrichtigungen aus");
      return;
    }
    const perm = await requestNotificationPermission();
    if (perm !== "granted") {
      setDenied(perm === "denied");
      setMessage("Bitte erlaube Benachrichtigungen im Browser.");
      return;
    }
    setDenied(false);
    setEnabled(true);
    setNotifyEnabled(true);
    setMessage(`Aktiv: wir erinnern dich täglich um ${getReminderTime()} Uhr.`);
    void showNotification("Erinnerungen aktiv 🔔", `Wir melden uns täglich um ${getReminderTime()} Uhr.`, "np-test");
  };

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card/40 p-4 backdrop-blur">
      <h2 className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
        Benachrichtigungen
      </h2>

      <button
        type="button"
        onClick={toggle}
        disabled={!supported}
        className="mt-3 flex w-full items-center justify-between rounded-xl border border-border bg-background/40 px-3 py-3 text-left disabled:opacity-60"
      >
        <span className="text-xs">
          Tägliche Erinnerung
          <span className="mt-0.5 block text-[10px] text-muted-foreground">
            Hinweis, wenn dein Tagesziel noch offen ist – plus Freundschaftsanfragen und Battle-Starts.
          </span>
        </span>
        <span
          className={`ml-3 flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition ${
            enabled ? "bg-primary" : "bg-secondary"
          }`}
        >
          <span className={`h-5 w-5 rounded-full bg-background transition ${enabled ? "translate-x-5" : ""}`} />
        </span>
      </button>

      <div className="mt-3 rounded-2xl border border-primary/20 bg-primary/10 p-3 text-sm text-foreground">
        <div className="font-semibold">Was du bekommst</div>
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          <li>• tägliche Erinnerungen, wenn dein Ziel noch offen ist</li>
          <li>• Hinweise zu Streaks und Trainingsfortschritt</li>
          <li>• Benachrichtigungen bei neuen Freundschaften und Battles</li>
        </ul>
      </div>

      <label className="mt-3 flex items-center justify-between rounded-xl border border-border bg-background/40 px-3 py-3">
        <span className="text-xs">Uhrzeit</span>
        <input
          type="time"
          value={time}
          onChange={(e) => {
            setTime(e.target.value);
            setReminderTime(e.target.value);
            setMessage(`Erinnerung auf ${e.target.value} Uhr eingestellt.`);
          }}
          className="rounded-lg border border-border bg-background px-2 py-1 text-sm tabular-nums"
        />
      </label>

      {!supported && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Dein Browser unterstützt keine Benachrichtigungen. Installiere die App auf dem Homescreen.
        </p>
      )}
      {message && <p className="mt-3 text-[11px] text-muted-foreground">{message}</p>}
      {denied && (
        <p className="mt-2 text-[11px] text-destructive">
          Benachrichtigungen sind blockiert. Erlaube sie in den Browser-Einstellungen für diese Seite.
        </p>
      )}
    </section>
  );
}
