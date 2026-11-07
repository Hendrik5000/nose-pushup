// The current adapter does not expose SDK transport/input limits. Enforce them
// before either the MCP transport or the REST companion validates untrusted JSON.
export const MCP_REQUEST_LIMITS = Object.freeze({
  bodyBytes: 64 * 1024,
  batchRequests: 16,
  jsonElements: 1024,
  jsonDepth: 32,
});

type RequestContext = { request: Request };
type RequestHandler<T extends RequestContext> = (context: T) => Promise<Response>;

function rejectRequest(message: string, status = 413): Response {
  return new Response(
    JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32600, message } }),
    {
      status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    },
  );
}

async function readBoundedBody(request: Request): Promise<ArrayBuffer | Response> {
  const declaredLength = request.headers.get("content-length");
  if (
    declaredLength &&
    /^\d+$/.test(declaredLength) &&
    Number(declaredLength) > MCP_REQUEST_LIMITS.bodyBytes
  ) {
    void request.body?.cancel().catch(() => undefined);
    return rejectRequest("MCP request body exceeds the byte limit.");
  }

  const reader = request.body!.getReader();
  const body = new ArrayBuffer(MCP_REQUEST_LIMITS.bodyBytes);
  const bytes = new Uint8Array(body);
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (totalBytes + value.byteLength > MCP_REQUEST_LIMITS.bodyBytes) {
        void reader.cancel().catch(() => undefined);
        return rejectRequest("MCP request body exceeds the byte limit.");
      }
      bytes.set(value, totalBytes);
      totalBytes += value.byteLength;
    }
  } catch {
    return rejectRequest("Unable to read the MCP request body.", 400);
  } finally {
    reader.releaseLock();
  }

  return body.slice(0, totalBytes);
}

function jsonLimitError(body: ArrayBuffer): string | null {
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder().decode(body));
  } catch {
    // Preserve the adapter's existing invalid-JSON/content-type response. The
    // byte cap still applies, regardless of Content-Type or Content-Length.
    return null;
  }

  if (Array.isArray(value) && value.length > MCP_REQUEST_LIMITS.batchRequests) {
    return "MCP request exceeds the batch limit.";
  }

  // Count ALL JSON array elements/object members, not just known tool arguments:
  // this also covers REST input, protocol metadata, and unknown extra fields.
  const pending: { value: unknown; depth: number }[] = [{ value, depth: 1 }];
  let elements = 0;
  while (pending.length) {
    const current = pending.pop()!;
    if (current.value === null || typeof current.value !== "object") continue;
    if (current.depth > MCP_REQUEST_LIMITS.jsonDepth) return "MCP JSON exceeds the depth limit.";
    const container = current.value as Record<string, unknown>;
    const keys = Object.keys(container);
    elements += keys.length;
    if (elements > MCP_REQUEST_LIMITS.jsonElements)
      return "MCP JSON exceeds the input element limit.";
    for (const key of keys) {
      const child = container[key];
      if (child !== null && typeof child === "object") {
        pending.push({ value: child, depth: current.depth + 1 });
      }
    }
  }
  return null;
}

/** Keep authentication, tool permissions, params, and adapter response semantics unchanged. */
export function isMcpRequestPath(pathname: string): boolean {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return false;
  }
  // Conservatively cover encoded/trailing-slash aliases before router decoding.
  const canonical = new URL(
    decoded.replace(/\/{2,}/g, "/"),
    "https://mcp.invalid",
  ).pathname.replace(/\/+$/, "");
  return (
    canonical === "/mcp" ||
    canonical === "/.mcp/list-tools" ||
    canonical.startsWith("/.mcp/invoke-tool/")
  );
}

/** Bound a scoped request before it reaches TanStack's generated adapter route. */
export async function limitMcpRequest(request: Request): Promise<Request | Response> {
  if (!request.body) return request;
  const body = await readBoundedBody(request);
  if (body instanceof Response) return body;
  const error = jsonLimitError(body);
  if (error) return rejectRequest(error);
  // Replace the consumed stream with the same bounded bytes. No clone/tee can
  // accumulate an unbounded unread branch. Request metadata and auth survive.
  return new Request(request, { body });
}

export function withMcpRequestLimits<T extends RequestContext>(
  handler: RequestHandler<T>,
): RequestHandler<T> {
  return async (context) => {
    const bounded = await limitMcpRequest(context.request);
    if (bounded instanceof Response) return bounded;
    return handler({ ...context, request: bounded });
  };
}
