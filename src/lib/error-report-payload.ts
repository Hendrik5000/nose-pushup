export const ERROR_REPORT_CATEGORIES = [
  "network",
  "auth",
  "rendering",
  "sync",
  "other",
] as const;
export const ERROR_REPORT_SEVERITIES = ["warning", "error", "critical"] as const;
export const ERROR_REPORT_SOURCES = ["window", "console", "api", "service_worker"] as const;
export const ERROR_REPORT_ROUTE_KEYS = [
  "home",
  "mira",
  "profile",
  "friends",
  "health",
  "gym",
  "marketplace",
  "other",
] as const;

export type ErrorReportCategory = (typeof ERROR_REPORT_CATEGORIES)[number];
export type ErrorReportSeverity = (typeof ERROR_REPORT_SEVERITIES)[number];
export type ErrorReportSource = (typeof ERROR_REPORT_SOURCES)[number];
export type ErrorReportRouteKey = (typeof ERROR_REPORT_ROUTE_KEYS)[number];

export type SanitizedErrorReport = Readonly<{
  report_version: "1";
  occurred_minute: string;
  release_commit: string;
  category: ErrorReportCategory;
  severity: ErrorReportSeverity;
  source: ErrorReportSource;
  route_key: ErrorReportRouteKey;
  repeat_count: number;
}>;

const REPORT_KEYS = [
  "report_version",
  "occurred_minute",
  "release_commit",
  "category",
  "severity",
  "source",
  "route_key",
  "repeat_count",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOneOf<T extends readonly string[]>(value: unknown, choices: T): value is T[number] {
  return typeof value === "string" && (choices as readonly string[]).includes(value);
}

function isUtcMinute(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z$/.test(value)) return false;
  const parsed = new Date(`${value.slice(0, 16)}:00Z`);
  return Number.isFinite(parsed.getTime()) && `${parsed.toISOString().slice(0, 16)}Z` === value;
}

function isReleaseCommit(value: unknown): value is string {
  return typeof value === "string" && (value === "unknown" || /^[a-fA-F0-9]{7,40}$/.test(value));
}

export function parseSanitizedErrorReport(value: unknown): SanitizedErrorReport {
  if (!isRecord(value)) throw new Error("Invalid sanitized error report.");
  const keys = Object.keys(value);
  if (keys.length !== REPORT_KEYS.length || REPORT_KEYS.some((key) => !Object.hasOwn(value, key))) {
    throw new Error("Invalid sanitized error report.");
  }
  if (
    value.report_version !== "1" ||
    !isUtcMinute(value.occurred_minute) ||
    !isReleaseCommit(value.release_commit) ||
    !isOneOf(value.category, ERROR_REPORT_CATEGORIES) ||
    !isOneOf(value.severity, ERROR_REPORT_SEVERITIES) ||
    !isOneOf(value.source, ERROR_REPORT_SOURCES) ||
    !isOneOf(value.route_key, ERROR_REPORT_ROUTE_KEYS) ||
    !Number.isInteger(value.repeat_count) ||
    (value.repeat_count as number) < 1 ||
    (value.repeat_count as number) > 1000
  ) {
    throw new Error("Invalid sanitized error report.");
  }
  return Object.freeze({
    report_version: "1",
    occurred_minute: value.occurred_minute,
    release_commit: value.release_commit,
    category: value.category,
    severity: value.severity,
    source: value.source,
    route_key: value.route_key,
    repeat_count: value.repeat_count as number,
  });
}

export function serializeSanitizedErrorReport(value: unknown): string {
  return JSON.stringify(parseSanitizedErrorReport(value));
}

function mapSource(source: unknown): ErrorReportSource {
  switch (source) {
    case "console":
    case "console.error":
      return "console";
    case "api":
      return "api";
    case "service_worker":
      return "service_worker";
    default:
      return "window";
  }
}

function mapCategory(source: ErrorReportSource): ErrorReportCategory {
  switch (source) {
    case "api":
      return "network";
    case "service_worker":
      return "sync";
    case "window":
      return "rendering";
    default:
      return "other";
  }
}

function mapSeverity(severity: unknown): ErrorReportSeverity {
  if (severity === "critical") return "critical";
  if (severity === "warning") return "warning";
  return "error";
}

function mapRouteKey(pathname: unknown): ErrorReportRouteKey {
  if (typeof pathname !== "string") return "other";
  const pathOnly = pathname.split(/[?#]/, 1)[0] ?? "";
  const firstSegment = pathOnly.replace(/^\/+|\/+$/g, "").split("/")[0]?.toLowerCase() ?? "";
  switch (firstSegment) {
    case "":
    case "home":
      return "home";
    case "chat":
    case "mira":
      return "mira";
    case "profile":
    case "profile-page":
      return "profile";
    case "friends":
      return "friends";
    case "health":
      return "health";
    case "gym":
    case "training":
    case "workout":
    case "exercises":
    case "calisthenics":
    case "programs":
    case "run":
      return "gym";
    case "marketplace":
      return "marketplace";
    default:
      return "other";
  }
}

function toUtcMinute(date: Date): string {
  if (!Number.isFinite(date.getTime())) return new Date().toISOString().slice(0, 16) + "Z";
  return date.toISOString().slice(0, 16) + "Z";
}

/** Build the outbound object from only the three explicitly safe input fields. */
export function buildSanitizedErrorReport(
  input: { pathname?: unknown; source?: unknown; severity?: unknown },
  occurredAt: Date = new Date(),
): SanitizedErrorReport {
  const source = mapSource(input.source);
  return parseSanitizedErrorReport({
    report_version: "1",
    occurred_minute: toUtcMinute(occurredAt),
    release_commit: "unknown",
    category: mapCategory(source),
    severity: mapSeverity(input.severity),
    source,
    route_key: mapRouteKey(input.pathname),
    repeat_count: 1,
  });
}
