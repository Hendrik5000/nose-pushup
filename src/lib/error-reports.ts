/**
 * Automatic client error reports.
 * Full reports stay in localStorage; only a sanitized allowlist signal may leave the server.
 * Agent protocol: on next edit, read open reports and fix them.
 */

import { sendSanitizedErrorReport } from "./error-reporting.functions";
import { buildSanitizedErrorReport } from "./error-report-payload";

export type ErrorReport = {
  id: string;
  ts: string;
  message: string;
  name?: string;
  stack?: string;
  route: string;
  source: string;
  severity: "error" | "warning" | "info";
  userAgent?: string;
  userId?: string | null;
  extra?: Record<string, unknown>;
  fixed?: boolean;
};

const STORAGE_KEY = "np-error-reports";
const MAX_REPORTS = 40;

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function serializeError(error: unknown): Pick<ErrorReport, "message" | "name" | "stack"> {
  if (error instanceof Error) {
    return {
      message: error.message || String(error),
      name: error.name,
      stack: error.stack,
    };
  }
  if (typeof error === "string") return { message: error };
  try {
    return { message: JSON.stringify(error) };
  } catch {
    return { message: String(error) };
  }
}

export function getErrorReports(): ErrorReport[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ErrorReport[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveReports(list: ErrorReport[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_REPORTS)));
  } catch {
    // quota / private mode
  }
}

export function getOpenErrorReports(): ErrorReport[] {
  return getErrorReports().filter((r) => !r.fixed && r.severity === "error");
}

export function markReportFixed(id: string) {
  const list = getErrorReports().map((r) => (r.id === id ? { ...r, fixed: true } : r));
  saveReports(list);
}

export function clearFixedReports() {
  saveReports(getErrorReports().filter((r) => !r.fixed));
}

export function exportErrorReportsJson(): string {
  return JSON.stringify(getErrorReports(), null, 2);
}

export function reportError(
  error: unknown,
  context: {
    source?: string;
    severity?: "error" | "warning" | "info";
    extra?: Record<string, unknown>;
  } = {},
) {
  if (typeof window === "undefined") return;

  const ser = serializeError(error);
  // Deduplicate identical message+route within 30s (local-only values).
  const existing = getErrorReports();
  const now = Date.now();
  const dup = existing.find(
    (r) =>
      r.message === ser.message &&
      r.route === window.location.pathname &&
      now - new Date(r.ts).getTime() < 30_000,
  );
  if (dup) return;

  const report: ErrorReport = {
    id: uid(),
    ts: new Date().toISOString(),
    message: ser.message,
    name: ser.name,
    stack: ser.stack,
    route: window.location.pathname + window.location.search,
    source: context.source ?? "manual",
    severity: context.severity ?? "error",
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    extra: context.extra,
    fixed: false,
  };

  saveReports([report, ...existing].slice(0, MAX_REPORTS));

  // Build this payload only from the three safe inputs; no Error or report fields pass through.
  const sanitized = buildSanitizedErrorReport({
    pathname: window.location.pathname,
    source: context.source ?? "manual",
    severity: context.severity ?? "error",
  });
  void sendSanitizedErrorReport({ data: sanitized }).catch(() => {
    // Reporting must never create a second client error or telemetry event.
  });
}

let installed = false;

/** Call once from root (browser only). */
export function installGlobalErrorReporting() {
  if (typeof window === "undefined" || installed) return;
  installed = true;

  window.addEventListener("error", (event) => {
    reportError(event.error ?? event.message, {
      source: "window.onerror",
      extra: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    reportError(event.reason, {
      source: "unhandledrejection",
    });
  });

  // Soft console.error hook (non-destructive)
  const orig = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    try {
      const first = args[0];
      if (first instanceof Error) {
        reportError(first, { source: "console.error", severity: "warning" });
      } else if (typeof first === "string" && /error|failed|exception/i.test(first)) {
        reportError(args.map(String).join(" "), {
          source: "console.error",
          severity: "warning",
        });
      }
    } catch {
      // never break console
    }
    orig(...args);
  };
}
