/**
 * Automatic client error reports.
 * Stored in localStorage (always) and optionally Supabase (if migrated).
 * Agent protocol: on next edit, read open reports and fix them.
 */

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

async function trySupabaseInsert(report: ErrorReport) {
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data: userData } = await supabase.auth.getUser();
    const row = {
      id: report.id,
      message: report.message.slice(0, 2000),
      name: report.name?.slice(0, 200) ?? null,
      stack: report.stack?.slice(0, 8000) ?? null,
      route: report.route.slice(0, 500),
      source: report.source.slice(0, 200),
      severity: report.severity,
      user_agent: report.userAgent?.slice(0, 500) ?? null,
      user_id: userData.user?.id ?? null,
      extra: report.extra ?? {},
      created_at: report.ts,
    };
    // Table may not exist yet — ignore failures
    await supabase.from("error_reports").insert(row as never);
  } catch {
    // offline / missing table
  }
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
  // Deduplicate identical message+route within 30s
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
  void trySupabaseInsert(report);

  // Forward to Lovable if present
  try {
    window.__lovableEvents?.captureException?.(error, {
      source: report.source,
      route: report.route,
      ...context.extra,
    });
  } catch {
    // ignore
  }
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
