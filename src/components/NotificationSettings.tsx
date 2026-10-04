import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, BellOff, Send, Smartphone, Clock } from "lucide-react";
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
  subscribeToPush,
} from "@/lib/notifications";
import { supabase } from "@/integrations/supabase/client";

export function NotificationSettings() {
  const [supported, setSupported] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [time, setTime] = useState(DEFAULT_REMINDER_TIME);
  const [denied, setDenied] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSupported(notificationsSupported());
    setEnabled(isNotifyEnabled());
    setTime(getReminderTime());
    setDenied(notificationPermission() === "denied");

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg => {
        reg.pushManager.getSubscription().then(sub => {
          setPushEnabled(!!sub);
        });
      });
    }
  }, []);

  const toggleLocal = async () => {
    if (enabled) {
      setEnabled(false);
      setNotifyEnabled(false);
      toast.info("Erinnerungen deaktiviert");
      return;
    }
    const perm = await requestNotificationPermission();
    if (perm !== "granted") {
      setDenied(perm === "denied");
      toast.error("Berechtigung fehlt");
      return;
    }
    setDenied(false);
    setEnabled(true);
    setNotifyEnabled(true);
    toast.success("Erinnerungen aktiv!");
    void showNotification("Erinnerungen aktiv 🔔", `Wir melden uns täglich um ${getReminderTime()} Uhr.`, "np-test");
  };

  const togglePush = async () => {
    setLoading(true);
    try {
      if (pushEnabled) {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await sub.unsubscribe();
          const { data: userData } = await supabase.auth.getUser();
          if (userData.user) {
            await supabase.from('push_subscriptions').delete().eq('user_id', userData.user.id).eq('endpoint', sub.endpoint);
          }
        }
        setPushEnabled(false);
        toast.info("Push-Benachrichtigungen deaktiviert");
      } else {
        const perm = await requestNotificationPermission();
        if (perm !== "granted") {
          setDenied(perm === "denied");
          throw new Error("Permission not granted");
        }
        const sub = await subscribeToPush();
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) throw new Error("Nicht eingeloggt");
        const subJSON = sub.toJSON();
        const { error } = await supabase.from('push_subscriptions').upsert({
          user_id: userData.user.id,
          endpoint: subJSON.endpoint ?? "",
          p256dh: subJSON.keys?.p256dh ?? "",
          auth: subJSON.keys?.auth ?? "",
        });
        if (error) throw error;
        setPushEnabled(true);
        toast.success("Push-Benachrichtigungen aktiviert!");
      }
    } catch {
      toast.error("Fehler bei Push-Aktivierung");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div
        onClick={toggleLocal}
        className={`flex cursor-pointer items-center justify-between rounded-2xl border p-4 transition-all ${
          enabled ? "border-primary/50 bg-primary/5" : "border-border bg-secondary/40"
        }`}
      >
        <div className="flex items-center gap-4">
          <div className={`rounded-xl p-2.5 ${enabled ? "bg-primary text-primary-foreground" : "bg-secondary/60 text-muted-foreground"}`}>
            {enabled ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Tägliche Erinnerung</p>
            {!supported && <p className="text-[10px] text-muted-foreground">Nicht unterstützt</p>}
            {denied && <p className="text-[10px] text-muted-foreground">Berechtigung blockiert</p>}
          </div>
        </div>
      </div>
      <div
        onClick={!loading ? togglePush : undefined}
        className={`flex cursor-pointer items-center justify-between rounded-2xl border p-4 transition-all ${
          pushEnabled ? "border-primary/50 bg-primary/5" : "border-border bg-secondary/40"
        }`}
      >
        <div className="flex items-center gap-4">
          <div className={`rounded-xl p-2.5 ${pushEnabled ? "bg-primary text-primary-foreground" : "bg-secondary/60 text-muted-foreground"}`}>
            <Smartphone className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Cloud Push</p>
          </div>
        </div>
      </div>
      {enabled && (
        <div className="flex items-center justify-between rounded-2xl border border-border bg-secondary/40 p-4">
          <div className="flex items-center gap-4">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-foreground">Zeit</p>
          </div>
          <input
            type="time"
            value={time}
            onChange={(e) => {
              setTime(e.target.value);
              setReminderTime(e.target.value);
            }}
            className="bg-transparent text-foreground outline-none"
          />
        </div>
      )}
    </div>
  );
}
