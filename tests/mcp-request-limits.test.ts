import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  MCP_REQUEST_LIMITS as limits,
  isMcpRequestPath,
  withMcpRequestLimits,
} from "../src/lib/mcp/request-limits.server.ts";

const url = "https://alo.example/mcp";
const post = (body: string, headers: HeadersInit = {}) =>
  new Request(url, { method: "POST", body, headers });
const streamRequest = (body: ReadableStream<Uint8Array>, headers: HeadersInit = {}) =>
  new Request(url, { method: "POST", body, headers, duplex: "half" } as RequestInit & {
    duplex: "half";
  });

async function dispatch(request: Request) {
  let calls = 0;
  const response = await withMcpRequestLimits(async ({ request }: { request: Request }) => {
    calls++;
    return new Response(await request.text());
  })({ request });
  return { response, calls };
}

async function rejects(request: Request, message: RegExp) {
  const { response, calls } = await dispatch(request);
  assert.equal(response.status, 413);
  assert.equal(calls, 0, "untrusted input must not reach adapter/schema validation");
  assert.match(await response.text(), message);
}

test("valid bounded input preserves exact bytes, auth, method, URL, params and response", async () => {
  const text = JSON.stringify({ text: "Grüße", nested: [1, { ok: true }] });
  const request = post(text, {
    Authorization: "Bearer local-test",
    "Content-Type": "application/json",
  });
  const expected = new Response("adapter result", { status: 202 });
  const response = await withMcpRequestLimits(
    async (context: { request: Request; params: { tool: string }; marker: number }) => {
      assert.equal(context.request.url, url);
      assert.equal(context.request.method, "POST");
      assert.equal(context.request.headers.get("authorization"), "Bearer local-test");
      assert.equal(context.request.headers.get("content-type"), "application/json");
      assert.equal(await context.request.text(), text);
      assert.equal(context.params.tool, "echo");
      assert.equal(context.marker, 7);
      return expected;
    },
  )({ request, params: { tool: "echo" }, marker: 7 });
  assert.equal(response, expected);
});

test("bodyless GET/OPTIONS retain the original request and adapter semantics", async () => {
  for (const method of ["GET", "OPTIONS"]) {
    const request = new Request(url, { method });
    const response = await withMcpRequestLimits(async (context) => {
      assert.equal(context.request, request);
      return new Response(null, { status: 204 });
    })({ request });
    assert.equal(response.status, 204);
  }
});

test("streamed bodies are bounded and cancelled without trusting Content-Length", async () => {
  for (const headers of [{}, { "Content-Length": "1" }]) {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(limits.bodyBytes));
        controller.enqueue(new Uint8Array(1));
      },
      cancel() {
        cancelled = true;
      },
    });
    await rejects(streamRequest(stream, headers), /byte limit/);
    assert.equal(cancelled, true);
  }
});

test("declared oversized bodies are rejected before reading and cancelled", async () => {
  let reads = 0;
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>(
    {
      pull() {
        reads++;
      },
      cancel() {
        cancelled = true;
      },
    },
    { highWaterMark: 0 },
  );
  await rejects(
    streamRequest(stream, { "Content-Length": String(limits.bodyBytes + 1) }),
    /byte limit/,
  );
  assert.equal(reads, 0);
  assert.equal(cancelled, true);
});

test("byte cap counts UTF-8 bytes rather than JavaScript characters", async () => {
  await rejects(post(JSON.stringify("é".repeat(limits.bodyBytes / 2))), /byte limit/);
});

test("a body exactly at the byte cap is accepted", async () => {
  const text = JSON.stringify("x".repeat(limits.bodyBytes - 2));
  const { response, calls } = await dispatch(post(text));
  assert.equal(calls, 1);
  assert.equal(await response.text(), text);
});

test("top-level JSON-RPC batches have an explicit limit", async () => {
  const accepted = await dispatch(
    post(JSON.stringify(Array.from({ length: limits.batchRequests }, () => ({ method: "ping" })))),
  );
  assert.equal(accepted.calls, 1);
  await rejects(
    post(
      JSON.stringify(Array.from({ length: limits.batchRequests + 1 }, () => ({ method: "ping" }))),
    ),
    /batch limit/,
  );
});

test("nested array elements are counted even with a misleading content type", async () => {
  await rejects(
    post(JSON.stringify({ arguments: { values: Array(limits.jsonElements).fill(0) } }), {
      "Content-Type": "text/plain",
    }),
    /element limit/,
  );
});

test("object members and unknown fields count toward the same input budget", async () => {
  const object = Object.fromEntries(
    Array.from({ length: limits.jsonElements + 1 }, (_, i) => [String(i), 0]),
  );
  await rejects(post(JSON.stringify(object)), /element limit/);
});

test("combined object-member/array-element budget is inclusive at its boundary", async () => {
  const accepted = await dispatch(
    post(JSON.stringify({ values: Array(limits.jsonElements - 1).fill(0) })),
  );
  assert.equal(accepted.calls, 1);
  await rejects(
    post(JSON.stringify({ values: Array(limits.jsonElements).fill(0) })),
    /element limit/,
  );
});

test("deep JSON is rejected iteratively before adapter validation", async () => {
  const nested = (depth: number) => {
    let value: unknown = 0;
    for (let i = 0; i < depth; i++) value = { value };
    return JSON.stringify(value);
  };
  assert.equal((await dispatch(post(nested(limits.jsonDepth)))).calls, 1);
  await rejects(post(nested(limits.jsonDepth + 1)), /depth limit/);
});

test("bounded invalid JSON is left to the adapter's existing error handling", async () => {
  const text = "{ invalid JSON";
  const { response, calls } = await dispatch(post(text));
  assert.equal(calls, 1);
  assert.equal(await response.text(), text);
});

test("unreadable streams fail closed without disclosing internal diagnostics", async () => {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.error(new Error("private diagnostic"));
    },
  });
  const { response, calls } = await dispatch(streamRequest(stream));
  assert.equal(response.status, 400);
  assert.equal(calls, 0);
  assert.doesNotMatch(await response.text(), /private diagnostic/);
});

test("only active MCP protocol and REST routes use the shared server-entry boundary", () => {
  for (const pathname of [
    "/mcp",
    "/mcp/",
    "/%6dcp",
    "//mcp//",
    "/x%2F..%2Fmcp",
    "/.mcp/list-tools",
    "/.mcp/list-tools/",
    "/.mcp/invoke-tool/echo",
    "/.mcp/invoke-tool/echo/extra",
    "/.mcp/invoke-tool/echo%2Fextra",
  ]) {
    assert.equal(isMcpRequestPath(pathname), true, pathname);
  }
  for (const pathname of [
    "/.well-known/oauth-protected-resource",
    "/.mcp/invoke-tool",
    "/mcp-other",
    "/mcp.json",
    "/invalid%ZZ",
    "/api/health",
  ]) {
    assert.equal(isMcpRequestPath(pathname), false, pathname);
  }

  const server = readFileSync(new URL("../src/server.ts", import.meta.url), "utf8");
  const guard = server.indexOf("if (isMcpRequestPath(new URL(request.url).pathname))");
  const dispatch = server.indexOf("handler.fetch(request, env, ctx)");
  assert.ok(
    guard >= 0 && guard < dispatch,
    "the bounded request must precede TanStack route dispatch",
  );
  assert.match(server, /const boundedRequest = await limitMcpRequest\(request\)/);

  for (const path of ["mcp.ts", "[.mcp]/invoke-tool/$tool.ts", "[.mcp]/list-tools.ts"]) {
    const source = readFileSync(new URL(`../src/routes/${path}`, import.meta.url), "utf8");
    assert.match(source, /AUTO-GENERATED by @lovable\.dev\/mcp-js/, path);
    assert.doesNotMatch(source, /withMcpRequestLimits/, path);
    assert.match(source, /ANY: createTanStack(?:Mcp|InvokeTool|ListTools)Handler\(/, path);
    assert.match(source, /resourcePath: "\/mcp"/);
    assert.match(source, /metadataPath: "\/\.well-known\/oauth-protected-resource"/);
  }
});

test("the npm SDK override and lockfile resolve to the patched reviewed release", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const lock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));
  assert.equal(pkg.overrides["@modelcontextprotocol/sdk"], "1.32.2");
  assert.equal(lock.packages["node_modules/@modelcontextprotocol/sdk"].version, "1.32.2");
});
