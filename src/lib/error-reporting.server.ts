import {
  parseSanitizedErrorReport,
  serializeSanitizedErrorReport,
} from "./error-report-payload.ts";

const WEBHOOK_ENV_NAME = "ALO_CUE_ERROR_REPORT_WEBHOOK_URL";
const WEBHOOK_HOST = "api.manus.im";
const WEBHOOK_PATH =
  /^\/api\/webhook\/triggers\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REQUEST_TIMEOUT_MS = 4_000;
const MAX_REPORTS_PER_WINDOW = 10;
const REPORT_WINDOW_MS = 60_000;

function configuredWebhookUrl(): string | undefined {
  if (typeof process === "undefined") return undefined;
  return process.env[WEBHOOK_ENV_NAME];
}

function approvedWebhookUrl(value: unknown): URL | undefined {
  if (typeof value !== "string" || value.length > 256) return undefined;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.hostname !== WEBHOOK_HOST ||
      url.port !== "" ||
      url.username !== "" ||
      url.password !== "" ||
      url.search !== "" ||
      url.hash !== "" ||
      !WEBHOOK_PATH.test(url.pathname)
    ) {
      return undefined;
    }
    return url;
  } catch {
    return undefined;
  }
}

/** Per-runtime sliding-window cap; it requires no database or client-controlled identity. */
export function createSlidingWindowReportLimiter(
  limit: number,
  windowMs: number,
  now: () => number = Date.now,
): () => boolean {
  const timestamps: number[] = [];
  return () => {
    const currentTime = now();
    while (timestamps.length > 0 && timestamps[0] <= currentTime - windowMs) timestamps.shift();
    if (timestamps.length >= limit) return false;
    timestamps.push(currentTime);
    return true;
  };
}

const allowForward = createSlidingWindowReportLimiter(
  MAX_REPORTS_PER_WINDOW,
  REPORT_WINDOW_MS,
);

/**
 * Send only the exact validated report object. No input or transport error is logged,
 * so neither the bearer URL nor any client-supplied free text can enter telemetry.
 */
export async function forwardSanitizedErrorReport(
  input: unknown,
  options: {
    webhookUrl?: unknown;
    fetchImpl?: typeof fetch;
    rateLimitCheck?: () => boolean;
  } = {},
): Promise<void> {
  let body: string;
  try {
    body = serializeSanitizedErrorReport(parseSanitizedErrorReport(input));
  } catch {
    return;
  }

  const destination = approvedWebhookUrl(options.webhookUrl ?? configuredWebhookUrl());
  const rateLimitCheck = options.rateLimitCheck ?? allowForward;
  if (!destination || !rateLimitCheck()) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const fetchImpl = options.fetchImpl ?? fetch;
    await fetchImpl(destination.href, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      credentials: "omit",
      redirect: "error",
      signal: controller.signal,
    });
  } catch {
    // Keep reporting best-effort and never log the secret URL or request details.
  } finally {
    clearTimeout(timeout);
  }
}
