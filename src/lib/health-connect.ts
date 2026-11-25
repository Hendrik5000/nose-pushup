/**
 * Google Health Connect client for the web / TWA shell.
 *
 * Browsers cannot call Health Connect APIs directly. On Android we:
 * 1) Open Health Connect (permissions / app) via intents & Play Store
 * 2) Prefer a native bridge injected by the TWA/Android shell:
 *    window.NosePushHealthConnect.readSummary(days)
 * 3) Fall back to manual entry / CSV import (Smartwatch panel)
 */

export type HealthConnectSummary = {
  day: string;
  steps?: number;
  activeKcal?: number;
  sleepMin?: number;
  weightKg?: number | null;
  restingHr?: number | null;
  distanceM?: number | null;
  source: "health_connect" | "bridge" | "manual";
};

export type HealthConnectStatus = {
  isAndroid: boolean;
  hasBridge: boolean;
  lastSyncAt: string | null;
  autoSync: boolean;
  lastError: string | null;
};

type BridgeApi = {
  /** Returns JSON string or object with steps, activeKcal, sleepMin, weightKg, restingHr, day */
  readSummary?: (days?: number) => Promise<unknown> | unknown;
  requestPermissions?: () => Promise<boolean> | boolean;
  isAvailable?: () => Promise<boolean> | boolean;
};

declare global {
  interface Window {
    NosePushHealthConnect?: BridgeApi;
    AndroidHealthConnect?: BridgeApi;
  }
}

const STORAGE_LAST = "np-hc-last-sync";
const STORAGE_AUTO = "np-hc-auto-sync";
const STORAGE_CACHE = "np-hc-cache";

export const HC_PLAY_STORE =
  "https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata";

/** Health Connect app package */
export const HC_PACKAGE = "com.google.android.apps.healthdata";

export function isAndroidDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

export function getHealthConnectBridge(): BridgeApi | null {
  if (typeof window === "undefined") return null;
  return window.NosePushHealthConnect ?? window.AndroidHealthConnect ?? null;
}

export function hasHealthConnectBridge(): boolean {
  return !!getHealthConnectBridge();
}

export function getHcAutoSync(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_AUTO) === "1";
}

export function setHcAutoSync(on: boolean) {
  window.localStorage.setItem(STORAGE_AUTO, on ? "1" : "0");
}

export function getHcLastSyncAt(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_LAST);
}

function setHcLastSyncAt(iso: string) {
  window.localStorage.setItem(STORAGE_LAST, iso);
}

export function getHcCachedSummary(): HealthConnectSummary | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_CACHE);
    if (!raw) return null;
    return JSON.parse(raw) as HealthConnectSummary;
  } catch {
    return null;
  }
}

function cacheSummary(s: HealthConnectSummary) {
  window.localStorage.setItem(STORAGE_CACHE, JSON.stringify(s));
  setHcLastSyncAt(new Date().toISOString());
}

export function getHealthConnectStatus(): HealthConnectStatus {
  return {
    isAndroid: isAndroidDevice(),
    hasBridge: hasHealthConnectBridge(),
    lastSyncAt: getHcLastSyncAt(),
    autoSync: getHcAutoSync(),
    lastError: null,
  };
}

/** Open Google Health Connect app or Play Store listing. */
export function openHealthConnectApp(): void {
  if (typeof window === "undefined") return;

  // Try Android intent to launch Health Connect
  const intent = `intent://#Intent;` + `scheme=android-app;` + `package=${HC_PACKAGE};` + `end`;

  const fallbackTimer = window.setTimeout(() => {
    window.open(HC_PLAY_STORE, "_blank", "noopener,noreferrer");
  }, 1200);

  try {
    // iframe trick is less reliable; location works in Chrome Android
    window.location.href = intent;
  } catch {
    window.open(HC_PLAY_STORE, "_blank", "noopener,noreferrer");
  }

  // If still visible after a bit, user likely stayed — clear only if they navigate away
  window.setTimeout(() => window.clearTimeout(fallbackTimer), 2000);
}

/** Open Play Store page for Health Connect. */
export function openHealthConnectPlayStore(): void {
  if (typeof window === "undefined") return;
  window.open(HC_PLAY_STORE, "_blank", "noopener,noreferrer");
}

export function normalizeSummary(raw: unknown): HealthConnectSummary | null {
  if (!raw) return null;
  // Bridge may return string JSON
  if (typeof raw === "string") {
    try {
      return normalizeSummary(JSON.parse(raw));
    } catch {
      return null;
    }
  }
  if (typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const steps = normalizeMetric(o.steps ?? o.stepCount, 0, 200000, true);
  const activeKcal = normalizeMetric(o.activeKcal ?? o.active_kcal ?? o.calories, 0, 20000, true);
  const sleepRaw =
    o.sleepMin ?? o.sleep_min ?? (o.sleepHours != null ? Number(o.sleepHours) * 60 : undefined);
  const sleepMin = normalizeMetric(sleepRaw, 0, 1440, true);
  const normalizedWeight = normalizeMetric(o.weightKg ?? o.weight_kg, 20, 400);
  const weightKg =
    normalizedWeight !== undefined && normalizedWeight > 20 && normalizedWeight < 400
      ? normalizedWeight
      : undefined;
  const normalizedRestingHr = normalizeMetric(o.restingHr ?? o.resting_hr, 30, 220);
  const restingHr =
    normalizedRestingHr !== undefined && normalizedRestingHr > 30 && normalizedRestingHr < 220
      ? normalizedRestingHr
      : undefined;
  const normalizedDistance = normalizeMetric(
    o.distanceM ?? o.distance_m,
    0,
    Number.POSITIVE_INFINITY,
  );
  const distanceM =
    normalizedDistance !== undefined && normalizedDistance > 0 ? normalizedDistance : undefined;
  const day =
    typeof o.day === "string"
      ? o.day.slice(0, 10)
      : typeof o.date === "string"
        ? o.date.slice(0, 10)
        : new Date().toISOString().slice(0, 10);

  if (
    steps === undefined &&
    activeKcal === undefined &&
    sleepMin === undefined &&
    weightKg === undefined &&
    restingHr === undefined &&
    distanceM === undefined
  ) {
    return null;
  }

  return {
    day,
    ...(steps !== undefined ? { steps } : {}),
    ...(activeKcal !== undefined ? { activeKcal } : {}),
    ...(sleepMin !== undefined ? { sleepMin } : {}),
    ...(weightKg !== undefined ? { weightKg } : {}),
    ...(restingHr !== undefined ? { restingHr } : {}),
    ...(distanceM !== undefined ? { distanceM } : {}),
    source: "health_connect",
  };
}

function normalizeMetric(
  value: unknown,
  min: number,
  max: number,
  round = false,
): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return undefined;
  return round ? Math.round(parsed) : parsed;
}

/**
 * Request permissions via native bridge, or guide user to Health Connect app.
 */
export async function requestHealthConnectPermissions(): Promise<{
  ok: boolean;
  via: "bridge" | "app";
  message: string;
}> {
  const bridge = getHealthConnectBridge();
  if (bridge?.requestPermissions) {
    try {
      const ok = await Promise.resolve(bridge.requestPermissions());
      return {
        ok: !!ok,
        via: "bridge",
        message: ok
          ? "Berechtigungen erteilt"
          : "Berechtigungen abgelehnt — in Health Connect freigeben",
      };
    } catch (e) {
      return {
        ok: false,
        via: "bridge",
        message: e instanceof Error ? e.message : "Bridge-Fehler",
      };
    }
  }

  openHealthConnectApp();
  return {
    ok: true,
    via: "app",
    message:
      "Health Connect geöffnet — erlaube den Zugriff für diese App, dann hier „Daten synchronisieren“ tippen.",
  };
}

/**
 * Read today's (or range) summary from bridge. Returns null if no bridge / no data.
 */
export async function readHealthConnectSummary(days = 1): Promise<HealthConnectSummary | null> {
  const bridge = getHealthConnectBridge();
  if (!bridge?.readSummary) return getHcCachedSummary();

  try {
    const raw = await Promise.resolve(bridge.readSummary(days));
    const summary = normalizeSummary(raw);
    if (summary) {
      summary.source = "bridge";
      cacheSummary(summary);
    }
    return summary;
  } catch {
    return getHcCachedSummary();
  }
}

/**
 * Persist summary into Supabase health_entries.
 */
export async function persistHealthConnectSummary(
  summary: HealthConnectSummary,
): Promise<{ error: string | null }> {
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return { error: "Nicht angemeldet" };

    const { error } = await supabase
      .from("health_entries")
      .upsert(buildHealthConnectEntryPayload(u.user.id, summary), { onConflict: "user_id,day" });

    if (error) return { error: error.message };

    if (summary.weightKg !== undefined && summary.weightKg !== null) {
      await supabase.from("profiles").update({ weight_kg: summary.weightKg }).eq("id", u.user.id);
    }

    cacheSummary(summary);
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Speichern fehlgeschlagen" };
  }
}

/**
 * Full sync: bridge read → Supabase. Without bridge, returns guidance.
 */
export async function syncHealthConnect(): Promise<{
  ok: boolean;
  summary: HealthConnectSummary | null;
  message: string;
}> {
  const bridge = getHealthConnectBridge();

  if (bridge?.readSummary) {
    const summary = await readHealthConnectSummary(1);
    if (!summary) {
      return {
        ok: false,
        summary: null,
        message: "Keine Daten von Health Connect — Berechtigungen prüfen",
      };
    }
    const { error } = await persistHealthConnectSummary(summary);
    if (error) return { ok: false, summary, message: error };
    return {
      ok: true,
      summary,
      message: `Sync OK${
        summary.steps !== undefined ? `: ${summary.steps.toLocaleString("de-DE")} Schritte` : ""
      }`,
    };
  }

  // No native bridge: cannot pull silently from Health Connect in pure web
  return {
    ok: false,
    summary: getHcCachedSummary(),
    message: isAndroidDevice()
      ? "Kein nativer Health-Connect-Bridge. Health Connect öffnen, Daten freigeben, oder Werte manuell / per CSV importieren. Für Auto-Sync die Android-TWA mit NosePushHealthConnect-Bridge bauen (siehe ANDROID.md)."
      : "Health Connect ist nur auf Android verfügbar. Auf dem PC: CSV/JSON importieren oder manuell eintragen.",
  };
}

/** Apply a user-entered snapshot as Health Connect-sourced data. */
export function buildManualHealthConnectSummary(input: {
  day?: string;
  steps?: number;
  activeKcal?: number;
  sleepHours?: number;
  weightKg?: number | null;
}): HealthConnectSummary {
  const steps = normalizeMetric(input.steps, 0, 200_000, true);
  const activeKcal = normalizeMetric(input.activeKcal, 0, 20_000, true);
  const sleepHours = normalizeMetric(input.sleepHours, 0, 24);
  const sleepMin =
    sleepHours === undefined ? undefined : normalizeMetric(sleepHours * 60, 0, 1440, true);
  const normalizedWeight =
    input.weightKg === undefined || input.weightKg === null
      ? undefined
      : normalizeMetric(input.weightKg, 20, 400);
  const weightKg =
    normalizedWeight !== undefined && normalizedWeight > 20 && normalizedWeight < 400
      ? normalizedWeight
      : undefined;

  return {
    day: input.day ?? new Date().toISOString().slice(0, 10),
    ...(steps !== undefined ? { steps } : {}),
    ...(activeKcal !== undefined ? { activeKcal } : {}),
    ...(sleepMin !== undefined ? { sleepMin } : {}),
    ...(weightKg !== undefined ? { weightKg } : {}),
    source: "health_connect",
  };
}

export async function saveManualAsHealthConnect(input: {
  day?: string;
  steps?: number;
  activeKcal?: number;
  sleepHours?: number;
  weightKg?: number | null;
}): Promise<{ error: string | null; summary: HealthConnectSummary }> {
  const summary = buildManualHealthConnectSummary(input);
  if (
    summary.steps === undefined &&
    summary.activeKcal === undefined &&
    summary.sleepMin === undefined &&
    summary.weightKg === undefined
  ) {
    return { error: "Mindestens einen gültigen Gesundheitswert eingeben", summary };
  }

  const { error } = await persistHealthConnectSummary(summary);
  return { error, summary };
}

/** Build the partial row used for the health_entries upsert. */
export function buildHealthConnectEntryPayload(
  userId: string,
  summary: HealthConnectSummary,
): {
  user_id: string;
  day: string;
  source: "health_connect";
  steps?: number;
  active_kcal?: number;
  sleep_min?: number;
  weight_kg?: number;
} {
  return {
    user_id: userId,
    day: summary.day,
    ...(summary.steps !== undefined ? { steps: summary.steps } : {}),
    ...(summary.activeKcal !== undefined ? { active_kcal: summary.activeKcal } : {}),
    ...(summary.sleepMin !== undefined ? { sleep_min: summary.sleepMin } : {}),
    ...(summary.weightKg !== undefined && summary.weightKg !== null
      ? { weight_kg: summary.weightKg }
      : {}),
    source: "health_connect",
  };
}
