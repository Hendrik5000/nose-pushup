import assert from "node:assert/strict";
import test from "node:test";
import { auth, defineMcp, defineTool } from "@lovable.dev/mcp-js";
import {
  createTanStackMcpHandler,
  createTanStackInvokeToolHandler,
  createTanStackListToolsHandler,
} from "@lovable.dev/mcp-js/stacks/tanstack";
import { z } from "zod";
import { MCP_REQUEST_LIMITS, withMcpRequestLimits } from "../src/lib/mcp/request-limits.server.ts";

function fixture(secured = false) {
  let calls = 0;
  const mcp = defineMcp({
    name: "security-test",
    title: "Local security test",
    version: "0.0.0",
    instructions: "",
    metrics: false,
    ...(secured
      ? {
          auth: auth.oauth.issuer({
            issuer: "https://auth.invalid",
            acceptedAudiences: "authenticated",
          }),
        }
      : {}),
    tools: [
      defineTool({
        name: "echo",
        title: "Local echo",
        description: "Returns only its test input.",
        inputSchema: { text: z.string().max(256) },
        handler: ({ text }) => {
          calls++;
          return { content: [{ type: "text", text }] };
        },
      }),
    ],
  });
  const options = { resourcePath: "/mcp" };
  return {
    protocol: withMcpRequestLimits(createTanStackMcpHandler(mcp, options)),
    invoke: withMcpRequestLimits(createTanStackInvokeToolHandler(mcp, options)),
    list: withMcpRequestLimits(createTanStackListToolsHandler(mcp, options)),
    calls: () => calls,
  };
}
const request = (path: string, body?: unknown) =>
  new Request(`https://alo.example${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

test("patched SDK and existing adapter handle normal MCP and REST calls", async () => {
  const f = fixture();
  const listing = await f.list({ request: request("/.mcp/list-tools") });
  assert.equal(listing.status, 200);
  assert.match(await listing.text(), /echo/);
  const init = await f.protocol({
    request: request("/mcp", {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "local-test", version: "1" },
      },
    }),
  });
  assert.equal(init.status, 200);
  assert.match(await init.text(), /protocolVersion/);
  const call = await f.protocol({
    request: request("/mcp", {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "echo", arguments: { text: "local-protocol-ok" } },
    }),
  });
  assert.equal(call.status, 200);
  assert.match(await call.text(), /local-protocol-ok/);
  const rest = await f.invoke({
    request: request("/.mcp/invoke-tool/echo", { text: "local-rest-ok" }),
    params: { tool: "echo" },
  });
  assert.equal(rest.status, 200);
  assert.match(await rest.text(), /local-rest-ok/);
  assert.equal(f.calls(), 2);
});

test("all real adapter boundaries reject excessive input before any tool dispatch", async () => {
  const f = fixture();
  const payloads = [
    "x".repeat(MCP_REQUEST_LIMITS.bodyBytes),
    { extra: Array(1025).fill(0) },
    Array(17).fill({}),
  ];
  for (const payload of payloads) {
    for (const [path, handler] of [
      ["/mcp", f.protocol],
      ["/.mcp/list-tools", f.list],
    ] as const) {
      assert.equal((await handler({ request: request(path, payload) })).status, 413);
    }
    assert.equal(
      (
        await f.invoke({
          request: request("/.mcp/invoke-tool/echo", payload),
          params: { tool: "echo" },
        })
      ).status,
      413,
    );
  }
  assert.equal(f.calls(), 0);
  const followup = await f.invoke({
    request: request("/.mcp/invoke-tool/echo", { text: "still usable" }),
    params: { tool: "echo" },
  });
  assert.equal(followup.status, 200);
  assert.equal(f.calls(), 1);
});

test("bounded requests retain the adapter's existing authentication requirement", async () => {
  const f = fixture(true);
  const response = await f.invoke({
    request: request("/.mcp/invoke-tool/echo", { text: "not authorized" }),
    params: { tool: "echo" },
  });
  assert.equal(response.status, 401);
  assert.ok(response.headers.get("WWW-Authenticate"));
  assert.equal(f.calls(), 0);
});
