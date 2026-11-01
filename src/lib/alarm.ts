import { scopedStorageKey } from "@/integrations/supabase/backendScope";

export const ALARM_SETTINGS_EVENT = "alo-alarm-settings-changed";
export const DEFAULT_ALARM_TIME = "07:00";
export const ALARM_GRACE_MS = 5 * 60 * 1000;

export type AlarmSettings = {
  enabled: boolean;
  time: string;
  lastTriggeredFor?: string;
  snoozeUntil?: string;
};

export const DEFAULT_ALARM_SETTINGS: AlarmSettings = {
  enabled: false,
  time: DEFAULT_ALARM_TIME,
};

export function isValidAlarmTime(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function storageKey(userId: string) {
  return scopedStorageKey("alo-alarm", userId);
}

export function readSavedAlarmSettings(userId: string): AlarmSettings | null {
  if (typeof window === "undefined") return null;
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(storageKey(userId)) ?? "null");
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const settings = value as Partial<AlarmSettings>;
    if (!isValidAlarmTime(settings.time)) return null;
    return {
      enabled: settings.enabled === true,
      time: settings.time,
      ...(typeof settings.lastTriggeredFor === "string"
        ? { lastTriggeredFor: settings.lastTriggeredFor }
        : {}),
      ...(typeof settings.snoozeUntil === "string" &&
      Number.isFinite(Date.parse(settings.snoozeUntil))
        ? { snoozeUntil: settings.snoozeUntil }
        : {}),
    };
  } catch {
    return null;
  }
}

export function readAlarmSettings(userId: string): AlarmSettings {
  return readSavedAlarmSettings(userId) ?? { ...DEFAULT_ALARM_SETTINGS };
}

export function saveAlarmSettings(userId: string, settings: AlarmSettings) {
  if (typeof window === "undefined") return;
  if (!isValidAlarmTime(settings.time)) throw new Error("Bitte eine gültige Weckzeit wählen.");
  window.localStorage.setItem(storageKey(userId), JSON.stringify(settings));
  window.dispatchEvent(new Event(ALARM_SETTINGS_EVENT));
}

export function localAlarmDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Returns a stable due token only for the scheduled minute or a short resume grace period. */
export function getDueAlarm(settings: AlarmSettings, now: Date): string | null {
  if (!settings.enabled) return null;

  if (settings.snoozeUntil) {
    const snoozeAt = Date.parse(settings.snoozeUntil);
    const snoozeToken = `snooze:${Math.floor(snoozeAt / 60_000)}`;
    const overdue = now.getTime() - snoozeAt;
    if (
      Number.isFinite(snoozeAt) &&
      overdue >= 0 &&
      overdue <= ALARM_GRACE_MS &&
      settings.lastTriggeredFor !== snoozeToken
    ) {
      return snoozeToken;
    }
  }

  const [hours, minutes] = settings.time.split(":").map(Number);
  const scheduled = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hours,
    minutes,
    0,
    0,
  );
  const overdue = now.getTime() - scheduled.getTime();
  const dailyToken = localAlarmDateKey(now);
  return overdue >= 0 && overdue <= ALARM_GRACE_MS && settings.lastTriggeredFor !== dailyToken
    ? dailyToken
    : null;
}

export function getNextAlarmDate(time: string, now = new Date()): Date | null {
  if (!isValidAlarmTime(time)) return null;
  const [hours, minutes] = time.split(":").map(Number);
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next;
}
