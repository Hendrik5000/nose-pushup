import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildSanitizedErrorReport,
  parseSanitizedErrorReport,
  serializeSanitizedErrorReport,
} from "../src/lib/error-report-payload.ts";
import {
  createSlidingWindowReportLimiter,
  forwardSanitizedErrorReport,
} from "../src/lib/error-reporting.server.ts";

const validReport = {
  report_version: "1",
  occurred_minute: "2026-11-07T21:32Z",
  release_commit: "unknown",
  category: "rendering",
  severity: "error",
  source: "window",
  route_key: "home",
  repeat_count: 1,
} as const;

const expectedKeys = [
  "report_version",
  "occurred_minute",
  "release_commit",
  "category",
  "severity",
  "source",
  "route_key",
  "repeat_count",
].sort();

test("accepted report has exactly the webhook's eight allowed fields", () => {
  const parsed = parseSanitizedErrorReport(validReport);
  assert.deepEqual(Object.keys(parsed).sort(), expectedKeys);
  assert.deepEqual(parsed, validReport);
});

test("rejects missing, additional, or non-object fields", () => {
  const { repeat_count: _repeatCount, ...missing } = validReport;
  assert.throws(() => parseSanitizedErrorReport(missing), /Invalid sanitized error report/);
  assert.throws(
    () => parseSanitizedErrorReport({ ...validReport, message: "do not forward" }),
    /Invalid sanitized error report/,
  );
  assert.throws(() => parseSanitizedErrorReport(null), /Invalid sanitized error report/);
  assert.throws(() => parseSanitizedErrorReport([]), /Invalid sanitized error report/);
});

test("rejects invalid versions, timestamps, commits, enum values, and repeat counts", () => {
  const invalidReports: unknown[] = [
    { ...validReport, report_version: "2" },
    { ...validReport, occurred_minute: "2026-02-31T21:32Z" },
    { ...validReport, occurred_minute: "2026-11-07T21:32:00Z" },
    { ...validReport, release_commit: "not-a-commit" },
    { ...validReport, category: "other; details" },
    { ...validReport, severity: "info" },
    { ...validReport, source: "window.onerror" },
    { ...validReport, route_key: "/profile/123" },
    { ...validReport, repeat_count: 0 },
    { ...validReport, repeat_count: 1001 },
    { ...validReport, repeat_count: 1.5 },
  ];
  for (const value of invalidReports) {
    assert.throws(() => parseSanitizedErrorReport(value), /Invalid sanitized error report/);
  }
});

test("builder reads only safe classification inputs and never reads raw diagnostics", () => {
  const sensitive = Object.fromEntries(
    ["message", "name", "stack", "userAgent", "userId", "extra", "route"].map((key) => [
      key,
      {
        get() {
          throw new Error(`Forbidden field accessed: ${key}`);
        },
      },
    ]),
  );
  const input = Object.defineProperties(
    {
      pathname: "/profile/private-user?email=person@example.test&token=secret",
      source: "window.onerror",
      severity: "warning",
    },
    Object.fromEntries(Object.entries(sensitive)),
  );

  const report = buildSanitizedErrorReport(input, new Date("2026-11-07T21:32:44.000Z"));
  assert.deepEqual(report, {
    report_version: "1",
    occurred_minute: "2026-11-07T21:32Z",
    release_commit: "unknown",
    category: "rendering",
    severity: "warning",
    source: "window",
    route_key: "profile",
    repeat_count: 1,
  });
  assert.deepEqual(Object.keys(report).sort(), expectedKeys);
});

test("source and route are mapped to fixed keys, never copied as free text", () => {
  const api = buildSanitizedErrorReport(
    { pathname: "/api/user/secret-id?query=private", source: "api", severity: "error" },
    new Date("2026-11-07T21:32:00.000Z"),
  );
  assert.equal(api.category, "network");
  assert.equal(api.source, "api");
  assert.equal(api.route_key, "other");

  const consoleReport = buildSanitizedErrorReport(
    { pathname: "/chat/session-id?private=1", source: "console.error", severity: "info" },
    new Date("2026-11-07T21:32:00.000Z"),
  );
  assert.equal(consoleReport.category, "other");
  assert.equal(consoleReport.source, "console");
  assert.equal(consoleReport.severity, "error");
  assert.equal(consoleReport.route_key, "mira");
});

test("serialized outbound body contains only validated fields and no sensitive values", () => {
  const rawValues = [
    "secret exception message",
    "SecretErrorName",
    "secret stack trace",
    "https://alo.example/profile?email=person@example.test",
    "Mozilla/5.0 private user-agent",
    "private-user-id",
    "arbitrary extra payload",
  ];
  const body = serializeSanitizedErrorReport(validReport);
  const decoded = JSON.parse(body) as Record<string, unknown>;
  assert.deepEqual(Object.keys(decoded).sort(), expectedKeys);
  assert.deepEqual(decoded, validReport);
  for (const raw of rawValues) assert.equal(body.includes(raw), false);
});

test("forwarder serializes exact payload through an injected mock, never a real request", async () => {
  let capturedBody = "";
  let capturedMethod = "";
  let capturedRedirect = "";
  let fetchCount = 0;
  const mockFetch: typeof fetch = async (input, init) => {
    fetchCount++;
    capturedBody = String(init?.body ?? "");
    capturedMethod = init?.method ?? "";
    capturedRedirect = init?.redirect ?? "";
    assert.match(String(input), /^https:\/\/api\.manus\.im\/api\/webhook\/triggers\/00000000-/);
    return new Response(null, { status: 202 });
  };

  await forwardSanitizedErrorReport(validReport, {
    webhookUrl: "https://api.manus.im/api/webhook/triggers/00000000-0000-0000-0000-000000000000",
    fetchImpl: mockFetch,
  });
  assert.equal(fetchCount, 1);
  assert.equal(capturedMethod, "POST");
  assert.equal(capturedRedirect, "manual");
  assert.deepEqual(JSON.parse(capturedBody), validReport);
  assert.deepEqual(Object.keys(JSON.parse(capturedBody)).sort(), expectedKeys);
});

test("invalid payloads and unapproved destinations never reach the injected transport", async () => {
  let fetchCount = 0;
  const mockFetch: typeof fetch = async () => {
    fetchCount++;
    return new Response(null, { status: 202 });
  };
  await forwardSanitizedErrorReport(
    { ...validReport, message: "forbidden" },
    {
      webhookUrl: "https://api.manus.im/api/webhook/triggers/00000000-0000-0000-0000-000000000000",
      fetchImpl: mockFetch,
    },
  );
  await forwardSanitizedErrorReport(validReport, {
    webhookUrl: "https://example.invalid/api/webhook/triggers/00000000-0000-0000-0000-000000000000",
    fetchImpl: mockFetch,
  });
  assert.equal(fetchCount, 0);
});

test("server-side sliding window caps outbound reports", () => {
  let time = 0;
  const allow = createSlidingWindowReportLimiter(2, 1_000, () => time);
  assert.equal(allow(), true);
  assert.equal(allow(), true);
  assert.equal(allow(), false);
  time = 999;
  assert.equal(allow(), false);
  time = 1_000;
  assert.equal(allow(), true);
});

test("reporting code no longer relays raw diagnostics to Supabase or Lovable telemetry", () => {
  const errorReports = readFileSync(
    new URL("../src/lib/error-reports.ts", import.meta.url),
    "utf8",
  );
  const lovableReporting = readFileSync(
    new URL("../src/lib/lovable-error-reporting.ts", import.meta.url),
    "utf8",
  );
  const serverForwarder = readFileSync(
    new URL("../src/lib/error-reporting.server.ts", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(errorReports, /trySupabaseInsert|from\(["']error_reports["']\)/);
  assert.doesNotMatch(errorReports, /__lovableEvents|captureException/);
  assert.doesNotMatch(lovableReporting, /__lovableEvents|captureException/);
  assert.match(errorReports, /buildSanitizedErrorReport/);
  assert.match(errorReports, /sendSanitizedErrorReport/);
  assert.match(serverForwarder, /serializeSanitizedErrorReport/);
  assert.doesNotMatch(
    serverForwarder,
    /console\.(?:log|error)|report\.(?:message|name|stack|route|userAgent|userId|extra)/,
  );
});

test("forwarder stops before transport when the server rate limiter denies a slot", async () => {
  let fetchCount = 0;
  const mockFetch: typeof fetch = async () => {
    fetchCount++;
    return new Response(null, { status: 202 });
  };
  await forwardSanitizedErrorReport(validReport, {
    webhookUrl: "https://api.manus.im/api/webhook/triggers/00000000-0000-0000-0000-000000000000",
    fetchImpl: mockFetch,
    rateLimitCheck: () => false,
  });
  assert.equal(fetchCount, 0);
});

test("client passes only the sanitized payload in TanStack's data envelope", () => {
  const client = readFileSync(new URL("../src/lib/error-reports.ts", import.meta.url), "utf8");
  assert.match(client, /sendSanitizedErrorReport\(\{ data: sanitized \}\)/);
});
