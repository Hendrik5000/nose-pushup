import { createHash } from "node:crypto";
import {
  RUNWARE_CAPABILITIES,
  RUNWARE_COST_LIMIT_AVAILABLE,
  RUNWARE_COST_LIMIT_REASON,
  RUNWARE_MODELS,
  type RunwareCapability,
  type RunwareModel,
  type RunwareResult,
  type RunwareStatus,
} from "./runware";

const API_URL = "https://api.runware.ai/v1";
const REQUEST_TIMEOUT_MS = 60_000;
const IDEMPOTENCY_TTL_MS = 10 * 60_000;
const RATE_WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 3;
const MAX_PROMPT_LENGTH = 4_000;
const MAX_DATA_URI_BYTES = 1024 * 1024;
const REQUEST_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RequestData = {
  capability: RunwareCapability;
  model: string;
  prompt: string;
  inputImage?: string;
  confirmed: true;
  requestId: string;
};
type CachedCall = { fingerprint: string; expiresAt: number; promise: Promise<RunwareResult> };
const idempotency = new Map<string, CachedCall>();
const activeStreams = new Map<string, { fingerprint: string; expiresAt: number }>();
const userRate = new Map<string, number[]>();
const activeUsers = new Set<string>();

const SAFE_MESSAGES = {
  unavailable: "Runware ist für dieses Konto nicht eingerichtet.",
  invalid: "Ungültige Runware-Anfrage.",
  provider:
    "Runware konnte die Anfrage nicht abschließen. Es wurde kein automatischer Wiederholungsversuch gestartet.",
  busy: "Runware ist gerade ausgelastet. Bitte später erneut versuchen.",
  rate: "Das Nutzungslimit wurde erreicht. Bitte später erneut versuchen.",
} as const;

export function parseAllowedUserIds(raw: string | undefined): ReadonlySet<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  );
}

export function isRunwareEnabledForUser(
  userId: string,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const key = env.RUNWARE_API_KEY?.trim();
  const ids = parseAllowedUserIds(env.RUNWARE_ALLOWED_USER_IDS);
  return Boolean(key && ids.size && ids.has(userId));
}

export function getRunwareStatusForUser(
  userId: string,
  env: NodeJS.ProcessEnv = process.env,
): RunwareStatus {
  const configured = Boolean(env.RUNWARE_API_KEY?.trim());
  const allowlist = parseAllowedUserIds(env.RUNWARE_ALLOWED_USER_IDS);
  const allowed = isRunwareEnabledForUser(userId, env);
  let reason = "Runware ist eingerichtet.";
  if (!configured && !allowlist.size)
    reason = "Runware ist nicht eingerichtet (API-Schlüssel und Nutzerfreigabe fehlen).";
  else if (!configured) reason = "Runware ist nicht eingerichtet (API-Schlüssel fehlt).";
  else if (!allowlist.size)
    reason = "Runware ist aus Sicherheitsgründen nicht freigegeben (Nutzer-Allowlist fehlt).";
  else if (!allowed) reason = "Runware ist für dieses Konto nicht freigegeben.";
  else if (!RUNWARE_COST_LIMIT_AVAILABLE) reason = RUNWARE_COST_LIMIT_REASON;
  return {
    available: allowed && RUNWARE_COST_LIMIT_AVAILABLE,
    reason,
    models: allowed ? RUNWARE_MODELS : [],
    capabilities: RUNWARE_CAPABILITIES,
  };
}

function assertInput(input: unknown): RequestData {
  if (!input || typeof input !== "object") throw new Error(SAFE_MESSAGES.invalid);
  const value = input as Partial<RequestData>;
  const requestId = value.requestId;
  const capability = RUNWARE_CAPABILITIES.find((item) => item.id === value.capability)?.id;
  if (value.confirmed !== true || typeof requestId !== "string" || !REQUEST_ID_RE.test(requestId))
    throw new Error(SAFE_MESSAGES.invalid);
  if (
    typeof value.prompt !== "string" ||
    !value.prompt.trim() ||
    value.prompt.length > MAX_PROMPT_LENGTH
  )
    throw new Error(SAFE_MESSAGES.invalid);
  if (!capability) throw new Error(SAFE_MESSAGES.invalid);
  if (capability === "image-analysis")
    throw new Error(
      "Bildanalyse ist derzeit nicht verfügbar: kein verifiziertes Requestschema freigegeben.",
    );
  const model = RUNWARE_MODELS.find(
    (entry) => entry.capability === capability && entry.id === value.model,
  );
  if (!model) throw new Error(SAFE_MESSAGES.invalid);
  if (value.inputImage !== undefined) validateImageDataUri(value.inputImage);
  if ((capability === "image-editing" || capability === "image-upscale") && !value.inputImage)
    throw new Error(SAFE_MESSAGES.invalid);
  if (value.inputImage && capability !== "image-editing" && capability !== "image-upscale")
    throw new Error(SAFE_MESSAGES.invalid);
  return {
    capability,
    model: model.id,
    prompt: value.prompt.trim(),
    ...(value.inputImage ? { inputImage: value.inputImage } : {}),
    confirmed: true,
    requestId,
  };
}

export function validateImageDataUri(value: string): void {
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) throw new Error(SAFE_MESSAGES.invalid);
  const encoded = match[2];
  if (!encoded || encoded.length % 4 !== 0 || (encoded.length * 3) / 4 > MAX_DATA_URI_BYTES + 2)
    throw new Error(SAFE_MESSAGES.invalid);
  let bytes: Buffer;
  try {
    bytes = Buffer.from(encoded, "base64");
  } catch {
    throw new Error(SAFE_MESSAGES.invalid);
  }
  if (!bytes.length || bytes.length > MAX_DATA_URI_BYTES) throw new Error(SAFE_MESSAGES.invalid);
  const mime = match[1];
  const valid =
    mime === "png"
      ? bytes.length >= 8 &&
        bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : mime === "jpeg"
        ? bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
        : bytes.length >= 12 &&
          bytes.toString("ascii", 0, 4) === "RIFF" &&
          bytes.toString("ascii", 8, 12) === "WEBP";
  if (!valid) throw new Error(SAFE_MESSAGES.invalid);
}

export function makeRunwareTask(input: unknown): Record<string, unknown> {
  return makeValidatedTask(assertInput(input));
}

function makeValidatedTask(input: RequestData, streaming = false): Record<string, unknown> {
  const base = { taskUUID: input.requestId, model: input.model, includeCost: true };
  switch (input.capability) {
    case "text":
      return {
        ...base,
        taskType: "textInference",
        ...(streaming ? { deliveryMethod: "stream" } : {}),
        messages: [
          {
            role: "system",
            content:
              "Du bist Mira, die allgemeine KI in Alo. Antworte auf Deutsch, klar und hilfreich. Es wurden keine App-Kontextdaten übermittelt.",
          },
          { role: "user", content: input.prompt },
        ],
        settings: { maxTokens: 1024, temperature: 0.7 },
      };
    case "image-generation":
      return {
        ...base,
        taskType: "imageInference",
        positivePrompt: input.prompt,
        width: 1024,
        height: 1024,
        numberResults: 1,
      };
    case "image-editing":
      return {
        ...base,
        taskType: "imageInference",
        positivePrompt: input.prompt,
        inputs: { referenceImages: [input.inputImage] },
        width: 1024,
        height: 1024,
        numberResults: 1,
      };
    case "image-upscale":
      return {
        ...base,
        taskType: "upscale",
        inputs: { image: input.inputImage },
        upscaleFactor: 2,
        settings: { enhanceDetails: true, realism: true },
      };
    case "audio-generation":
      return { ...base, taskType: "audioInference", speech: { text: input.prompt } };
    case "3d-generation":
      return { ...base, taskType: "3dInference", positivePrompt: input.prompt };
    default:
      throw new Error(SAFE_MESSAGES.invalid);
  }
}

function safeOutputUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      (url.hostname === "runware.ai" || url.hostname.endsWith(".runware.ai"))
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

function mapProviderResult(value: unknown, input: RequestData): RunwareResult {
  if (!value || typeof value !== "object") throw new Error(SAFE_MESSAGES.provider);
  const response = value as Record<string, unknown>;
  const cost =
    typeof response.cost === "number" && Number.isFinite(response.cost) && response.cost >= 0
      ? response.cost
      : undefined;
  const common = {
    id: input.requestId,
    capability: input.capability,
    model: input.model,
    ...(cost === undefined ? {} : { cost }),
  };
  if (input.capability === "text" && typeof response.text === "string")
    return { ...common, kind: "text", text: response.text };
  if (
    (input.capability === "image-generation" ||
      input.capability === "image-editing" ||
      input.capability === "image-upscale") &&
    safeOutputUrl(response.imageURL)
  )
    return { ...common, kind: "image", url: safeOutputUrl(response.imageURL)! };
  if (input.capability === "audio-generation" && safeOutputUrl(response.audioURL))
    return { ...common, kind: "audio", url: safeOutputUrl(response.audioURL)! };
  if (input.capability === "3d-generation") {
    const files = (response.outputs as { files?: unknown[] } | undefined)?.files;
    const file = Array.isArray(files)
      ? (files.find(
          (item) =>
            item &&
            typeof item === "object" &&
            safeOutputUrl((item as Record<string, unknown>).url),
        ) as Record<string, unknown> | undefined)
      : undefined;
    const url = file && safeOutputUrl(file.url);
    if (url) return { ...common, kind: "model", url };
  }
  throw new Error(SAFE_MESSAGES.provider);
}

/** Pure provider response mapping for mock tests; raw provider error details are never surfaced. */
export function mapRunwareResponse(payload: unknown, rawInput: unknown): RunwareResult {
  const input = assertInput(rawInput);
  if (!payload || typeof payload !== "object") throw new Error(SAFE_MESSAGES.provider);
  const body = payload as { data?: unknown; errors?: unknown };
  if (Array.isArray(body.errors) && body.errors.length) throw new Error(SAFE_MESSAGES.provider);
  if (!Array.isArray(body.data)) throw new Error(SAFE_MESSAGES.provider);
  const row = body.data.find(
    (item) =>
      item &&
      typeof item === "object" &&
      (item as Record<string, unknown>).taskUUID === input.requestId,
  );
  return mapProviderResult(row, input);
}

/** Provider UUIDs are scoped on the server, so a copied client request ID cannot address another account's task. */
export function scopedRunwareTaskId(userId: string, requestId: string): string {
  const hex = createHash("sha256").update(`${userId}:${requestId}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function fingerprint(input: RequestData): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

function pruneCache(now: number): void {
  for (const [key, entry] of idempotency) if (entry.expiresAt <= now) idempotency.delete(key);
  for (const [key, entry] of activeStreams) if (entry.expiresAt <= now) activeStreams.delete(key);
  if (idempotency.size > 500) {
    const oldest = [...idempotency.entries()]
      .sort((a, b) => a[1].expiresAt - b[1].expiresAt)
      .slice(0, idempotency.size - 500);
    oldest.forEach(([key]) => idempotency.delete(key));
  }
  for (const [user, hits] of userRate) {
    const recent = hits.filter((time) => time > now - RATE_WINDOW_MS);
    if (recent.length) userRate.set(user, recent);
    else userRate.delete(user);
  }
}

async function callRunware(
  userId: string,
  input: RequestData,
  key: string,
): Promise<RunwareResult> {
  const providerInput = { ...input, requestId: scopedRunwareTaskId(userId, input.requestId) };
  const task = makeValidatedTask(providerInput);
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify([task]),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(SAFE_MESSAGES.provider);
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(SAFE_MESSAGES.provider);
  }
  return { ...mapRunwareResponse(payload, providerInput), id: input.requestId };
}

/** Server-only implementation; callers must supply the authenticated Supabase user ID. */
export async function executeRunwareForUser(
  userId: string,
  rawInput: unknown,
  env: NodeJS.ProcessEnv = process.env,
): Promise<RunwareResult> {
  const input = assertInput(rawInput);
  const key = env.RUNWARE_API_KEY?.trim();
  if (!key || !isRunwareEnabledForUser(userId, env)) throw new Error(SAFE_MESSAGES.unavailable);
  const now = Date.now();
  pruneCache(now);
  const cacheKey = `${userId}:${input.requestId}`;
  const digest = fingerprint(input);
  const cached = idempotency.get(cacheKey);
  if (cached) {
    if (cached.fingerprint !== digest)
      throw new Error("Diese Request-ID wurde bereits für eine andere Anfrage verwendet.");
    return cached.promise;
  }
  const stream = activeStreams.get(cacheKey);
  if (stream) {
    if (stream.fingerprint !== digest)
      throw new Error("Diese Request-ID wurde bereits für eine andere Anfrage verwendet.");
    throw new Error(SAFE_MESSAGES.busy);
  }
  const hits = userRate.get(userId) ?? [];
  if (hits.length >= MAX_PER_WINDOW) throw new Error(SAFE_MESSAGES.rate);
  if (activeUsers.has(userId)) throw new Error(SAFE_MESSAGES.busy);
  userRate.set(userId, [...hits, now]);
  // Documented maxPrice only applies when model="auto". Fixed model IDs therefore
  // cannot currently be protected by a per-request ceiling; do not spend a global key.
  if (!RUNWARE_COST_LIMIT_AVAILABLE) {
    const promise = Promise.reject<RunwareResult>(new Error(RUNWARE_COST_LIMIT_REASON));
    idempotency.set(cacheKey, {
      fingerprint: digest,
      expiresAt: now + IDEMPOTENCY_TTL_MS,
      promise,
    });
    return promise;
  }
  activeUsers.add(userId);
  const promise = callRunware(userId, input, key).finally(() => activeUsers.delete(userId));
  idempotency.set(cacheKey, { fingerprint: digest, expiresAt: now + IDEMPOTENCY_TTL_MS, promise });
  return promise;
}

function ndjsonError(message: string): Response {
  return new Response(`${JSON.stringify({ type: "error", message })}\n`, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store, no-transform",
    },
  });
}

/**
 * Authenticated server-side text SSE proxy. TanStack's server-function handler
 * passes Response bodies through raw; this translates Runware SSE into the
 * UI contract: delta, result, or sanitized error NDJSON frames.
 */
export function streamRunwareForUser(
  userId: string,
  rawInput: unknown,
  env: NodeJS.ProcessEnv = process.env,
): Response {
  let input: RequestData;
  try {
    input = assertInput(rawInput);
    if (input.capability !== "text")
      throw new Error("Streaming ist ausschließlich für Text verfügbar.");
  } catch (error) {
    return ndjsonError(error instanceof Error ? error.message : SAFE_MESSAGES.invalid);
  }
  const key = env.RUNWARE_API_KEY?.trim();
  if (!key || !isRunwareEnabledForUser(userId, env)) return ndjsonError(SAFE_MESSAGES.unavailable);
  // Fixed model IDs cannot use Runware's model-router-only routing.maxPrice.
  // Do not send a paid task until a hard cost ceiling/preflight is supported.
  if (!RUNWARE_COST_LIMIT_AVAILABLE) return ndjsonError(RUNWARE_COST_LIMIT_REASON);

  const cacheKey = `${userId}:${input.requestId}`;
  const digest = fingerprint(input);
  pruneCache(Date.now());
  const existing = activeStreams.get(cacheKey) ?? idempotency.get(cacheKey);
  if (existing)
    return ndjsonError(
      existing.fingerprint === digest
        ? SAFE_MESSAGES.busy
        : "Diese Request-ID wurde bereits für eine andere Anfrage verwendet.",
    );
  const hits = userRate.get(userId) ?? [];
  if (hits.length >= MAX_PER_WINDOW) return ndjsonError(SAFE_MESSAGES.rate);
  if (activeUsers.has(userId)) return ndjsonError(SAFE_MESSAGES.busy);
  activeUsers.add(userId);
  userRate.set(userId, [...hits, Date.now()]);
  // Reserve the request ID before opening the paid provider stream. The marker
  // intentionally outlives client disconnects to avoid duplicate billing.
  activeStreams.set(cacheKey, { fingerprint: digest, expiresAt: Date.now() + IDEMPOTENCY_TTL_MS });

  const providerInput = { ...input, requestId: scopedRunwareTaskId(userId, input.requestId) };
  const encoder = new TextEncoder();
  const aborter = new AbortController();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (value: unknown) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));
      void (async () => {
        try {
          const response = await fetch(API_URL, {
            method: "POST",
            headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
            body: JSON.stringify([makeValidatedTask(providerInput, true)]),
            signal: AbortSignal.any([aborter.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]),
          });
          if (!response.ok || !response.body) throw new Error(SAFE_MESSAGES.provider);
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let text = "";
          let cost: number | undefined;
          let finished = false;
          const processLine = (raw: string) => {
            const line = raw.trimEnd();
            if (!line || line.startsWith(":")) return;
            if (!line.startsWith("data:")) return;
            const content = line.slice(5).trimStart();
            if (content === "[DONE]") {
              finished = true;
              return;
            }
            let event: Record<string, unknown>;
            try {
              event = JSON.parse(content) as Record<string, unknown>;
            } catch {
              throw new Error(SAFE_MESSAGES.provider);
            }
            if (Array.isArray(event.errors) && event.errors.length)
              throw new Error(SAFE_MESSAGES.provider);
            if (event.taskUUID && event.taskUUID !== providerInput.requestId)
              throw new Error(SAFE_MESSAGES.provider);
            const delta = event.delta as { text?: unknown } | undefined;
            if (typeof delta?.text === "string" && delta.text) {
              text += delta.text;
              if (text.length > 100_000) throw new Error(SAFE_MESSAGES.provider);
              send({ type: "delta", text: delta.text });
            }
            if (typeof event.cost === "number" && Number.isFinite(event.cost) && event.cost >= 0)
              cost = event.cost;
          };
          while (!finished) {
            const { done, value } = await reader.read();
            if (done) {
              buffer += decoder.decode();
              if (buffer.trim()) processLine(buffer);
              break;
            }
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) {
              processLine(line);
              if (finished) break;
            }
          }
          if (!finished) throw new Error(SAFE_MESSAGES.provider);
          send({
            type: "result",
            result: {
              id: input.requestId,
              capability: "text",
              model: input.model,
              text,
              kind: "text",
              ...(cost === undefined ? {} : { cost }),
            } satisfies RunwareResult,
          });
        } catch {
          try {
            send({ type: "error", message: SAFE_MESSAGES.provider });
          } catch {
            /* canceled by client */
          }
        } finally {
          activeUsers.delete(userId);
          try {
            controller.close();
          } catch {
            /* already canceled */
          }
        }
      })();
    },
    cancel() {
      aborter.abort();
      activeUsers.delete(userId);
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store, no-transform",
      "x-content-type-options": "nosniff",
    },
  });
}

export function getServerRunwareStatus(userId: string): RunwareStatus {
  return getRunwareStatusForUser(userId);
}

// Kept server-side, never included in status or errors. This makes the fixed contract auditable.
export type { RunwareCapability, RunwareModel };
