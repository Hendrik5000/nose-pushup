// Lokale Benachrichtigungen (Web Notifications API). Keine Server-Pushes nötig:
// solange die App (auch als installierte Web-App) läuft, erinnert sie ans Training.

import { decodeVapidPublicKey, isVapidPublicKeyConfigured, validateVapidPublicKey } from "./vapid";
export { VAPID_KEY_CONFIGURATION_ERROR } from "./vapid";

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

export async function requestNotificationPermission(): Promise<
  NotificationPermission | "unsupported"
> {
  if (!notificationsSupported()) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

function configuredVapidPublicKey(): string {
  const env =
    typeof import.meta === "undefined"
      ? undefined
      : (import.meta as { env?: Record<string, string> }).env;
  return env?.VITE_VAPID_PUBLIC_KEY?.trim() ?? "";
}

export function isPushVapidKeyConfigured(): boolean {
  return isVapidPublicKeyConfigured(configuredVapidPublicKey());
}

export async function validateConfiguredPushVapidKey(): Promise<void> {
  await validateVapidPublicKey(configuredVapidPublicKey());
}

export async function subscribeToPush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("Push-Benachrichtigungen werden von diesem Browser nicht unterstützt.");
  }

  const applicationServerKey = await validateVapidPublicKey(configuredVapidPublicKey());
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey,
  });
}

export async function showNotification(title: string, body: string, tag?: string, url?: string) {
  if (!notificationsSupported() || Notification.permission !== "granted") return;
  const options: NotificationOptions = {
    body,
    icon: "/favicon.png",
    badge: "/favicon.png",
    ...({ vibrate: [100, 50, 100] } as NotificationOptions),
    data: { url: url || "/" },
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
