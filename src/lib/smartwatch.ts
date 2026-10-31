/** Smartwatch / wearable integration helpers (web + Health Connect bridge). */

import { localDateKey } from "@/lib/training-dates";

export type WatchBrand = "galaxy" | "apple" | "pixel" | "fitbit" | "garmin" | "other";

export type WatchDevice = {
  id: string;
  brand: WatchBrand;
  name: string;
  pairedAt: string;
  lastSyncAt: string | null;
  enabled: boolean;
};

export type WatchSnapshot = {
  day: string;
  steps: number;
  activeKcal: number;
  sleepMin: number;
  restingHr: number | null;
  source: string;
  deviceId: string | null;
};

const DEVICES_KEY = "np-watch-devices";
const SNAPSHOT_KEY = "np-watch-snapshot";

export const WATCH_BRANDS: Array<{
  id: WatchBrand;
  label: string;
  hint: string;
  storeUrl?: string;
}> = [
  {
    id: "galaxy",
    label: "Galaxy Watch",
    hint: "Samsung Health → Health Connect",
    storeUrl: "https://play.google.com/store/apps/details?id=com.sec.android.app.shealth",
  },
  {
    id: "apple",
    label: "Apple Watch",
    hint: "Apple Health teilen / Export",
    storeUrl: "https://www.apple.com/apple-health/",
  },
  {
    id: "pixel",
    label: "Pixel Watch",
    hint: "Google Health / Fitbit",
    storeUrl: "https://play.google.com/store/apps/details?id=com.google.android.apps.fitness",
  },
  {
    id: "fitbit",
    label: "Fitbit",
    hint: "Fitbit App → Health Connect",
    storeUrl: "https://play.google.com/store/apps/details?id=com.fitbit.FitbitMobile",
  },
  {
    id: "garmin",
    label: "Garmin",
    hint: "Garmin Connect Export",
    storeUrl: "https://connect.garmin.com/",
  },
  { id: "other", label: "Andere", hint: "Manuell oder CSV-Import" },
];

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function getWatchDevices(): WatchDevice[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DEVICES_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as WatchDevice[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveDevices(list: WatchDevice[]) {
  localStorage.setItem(DEVICES_KEY, JSON.stringify(list));
}

export function pairWatch(brand: WatchBrand, customName?: string): WatchDevice {
  const meta = WATCH_BRANDS.find((b) => b.id === brand);
  const device: WatchDevice = {
    id: uid(),
    brand,
    name: customName?.trim() || meta?.label || "Smartwatch",
    pairedAt: new Date().toISOString(),
    lastSyncAt: null,
    enabled: true,
  };
  const list = getWatchDevices().filter((d) => d.brand !== brand);
  list.unshift(device);
  saveDevices(list.slice(0, 5));
  return device;
}

export function unpairWatch(id: string) {
  saveDevices(getWatchDevices().filter((d) => d.id !== id));
}

export function markWatchSynced(id: string) {
  const list = getWatchDevices().map((d) =>
    d.id === id ? { ...d, lastSyncAt: new Date().toISOString() } : d,
  );
  saveDevices(list);
}

export function getWatchSnapshot(): WatchSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as WatchSnapshot;
  } catch {
    return null;
  }
}

export function saveWatchSnapshot(snap: WatchSnapshot) {
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snap));
}

/** Parse simple step CSV: date,steps or steps only for the local calendar day. */
export function parseStepsCsv(
  text: string,
  now = new Date(),
): Array<{ day: string; steps: number }> {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const out: Array<{ day: string; steps: number }> = [];
  const today = localDateKey(now);

  for (const line of lines) {
    if (/date|tag|steps|schritte/i.test(line) && /[,;\t]/.test(line)) continue;
    const parts = line.split(/[,;\t]/).map((p) => p.trim());
    if (parts.length === 1) {
      const steps = parseInt(parts[0].replace(/\s/g, ""), 10);
      if (!Number.isNaN(steps)) out.push({ day: today, steps });
      continue;
    }
    const dayRaw = parts[0];
    const stepsRaw = parts[1] ?? parts[parts.length - 1];
    const steps = parseInt(String(stepsRaw).replace(/[^0-9]/g, ""), 10);
    if (Number.isNaN(steps)) continue;
    let day = today;
    // DD.MM.YYYY or YYYY-MM-DD
    const de = dayRaw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    const iso = dayRaw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (de) day = `${de[3]}-${de[2].padStart(2, "0")}-${de[1].padStart(2, "0")}`;
    else if (iso) day = `${iso[1]}-${iso[2]}-${iso[3]}`;
    out.push({ day, steps: Math.max(0, Math.min(200000, steps)) });
  }
  return out;
}

export function parseHealthJson(text: string, now = new Date()): Partial<WatchSnapshot> | null {
  try {
    const data = JSON.parse(text) as Record<string, unknown>;
    const steps = Number(data.steps ?? data.stepCount ?? data.Steps ?? 0);
    const activeKcal = Number(data.active_kcal ?? data.calories ?? data.activeCalories ?? 0);
    const sleepMin = Number(
      data.sleep_min ?? (data.sleepHours != null ? Number(data.sleepHours) * 60 : 0),
    );
    const restingHr =
      data.restingHr != null
        ? Number(data.restingHr)
        : data.resting_hr != null
          ? Number(data.resting_hr)
          : null;
    const day =
      typeof data.day === "string"
        ? data.day.slice(0, 10)
        : typeof data.date === "string"
          ? data.date.slice(0, 10)
          : localDateKey(now);
    if (!steps && !activeKcal && !sleepMin) return null;
    return {
      day,
      steps: Math.max(0, steps || 0),
      activeKcal: Math.max(0, activeKcal || 0),
      sleepMin: Math.max(0, sleepMin || 0),
      restingHr: restingHr && restingHr > 30 && restingHr < 220 ? restingHr : null,
    };
  } catch {
    return null;
  }
}

export function formatRelativeSync(iso: string | null): string {
  if (!iso) return "Noch nie";
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  if (diff < 60_000) return "Gerade eben";
  if (diff < 3_600_000) return `vor ${Math.floor(diff / 60_000)} Min.`;
  if (diff < 86_400_000) return `vor ${Math.floor(diff / 3_600_000)} Std.`;
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
