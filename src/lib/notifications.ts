// Lokale Benachrichtigungen (Web Notifications API). Keine Server-Pushes nötig:
// solange die App (auch als installierte Web-App) läuft, erinnert sie ans Training.

const ENABLED_KEY = "np-notify";
const TIME_KEY = "np-notify-time";
const LAST_KEY = "np-notify-last";

export const DEFAULT_REMINDER_TIME = "19:00";

export function notificationsSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  if (!notificationsSupported()) return "unsupported";
  return Notification.permission;
}

export function isNotifyEnabled() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(ENABLED_KEY) === "1";
}

export function setNotifyEnabled(on: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ENABLED_KEY, on ? "1" : "0");
}

export function getReminderTime(): string {
  if (typeof window === "undefined") return DEFAULT_REMINDER_TIME;
  return window.localStorage.getItem(TIME_KEY) ?? DEFAULT_REMINDER_TIME;
}

export function setReminderTime(time: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TIME_KEY, time);
}

export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!notificationsSupported()) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

/** Zeigt eine Benachrichtigung – über den Service Worker, falls vorhanden. */
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Push messaging is not supported');
  }
  const registration = await navigator.serviceWorker.ready;
  const vapidPublicKey = 'BEl62vp9IHZisv938A96792I37S0H479S4522409579304957930495793049579304957930495793';
  try {
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
    });
    return subscription;
  } catch (error) {
    console.error('Failed to subscribe to push notifications:', error);
    throw error;
  }
}

export async function showNotification(title: string, body: string, tag?: string, url?: string) {
  if (!notificationsSupported() || Notification.permission !== "granted") return;
  const options: NotificationOptions = {
    body,
    icon: "/favicon.png",
    badge: "/favicon.png",
    ...( { vibrate: [100, 50, 100] } as NotificationOptions ),
    data: { url: url || '/' },
    ...(tag ? { tag } : {}),
  };
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.showNotification(title, options);
        return;
      }
    }
    new Notification(title, options);
  } catch {
    /* ignore */
  }
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

/** true, wenn heute schon eine Erinnerung raus ist. */
export function reminderSentToday() {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(LAST_KEY) === todayKey();
}

export function markReminderSent() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LAST_KEY, todayKey());
}

/** true, wenn die eingestellte Uhrzeit heute bereits erreicht ist. */
export function reminderTimeReached(time = getReminderTime()) {
  const parts = time.split(":");
  const h = Number(parts[0] ?? 19);
  const m = Number(parts[1] ?? 0);
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes() >= h * 60 + m;
}
