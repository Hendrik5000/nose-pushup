import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getRunwareStatusForUser,
  scopedRunwareTaskId,
  isRunwareEnabledForUser,
  parseAllowedUserIds,
  validateImageDataUri,
  executeRunwareForUser,
  makeRunwareTask,
  mapRunwareResponse,
  streamRunwareForUser,
} from "../src/lib/runware.server";
import {
  RUNWARE_CAPABILITIES,
  RUNWARE_COST_LIMIT_AVAILABLE,
  RUNWARE_MODELS,
  RUNWARE_TEXT_STREAMING_AVAILABLE,
} from "../src/lib/runware";

const uuid = () => crypto.randomUUID();
const allowEnv = {
  RUNWARE_API_KEY: "secret-test-key",
  RUNWARE_ALLOWED_USER_IDS: "alice, bob, test-a, test-b, test-c",
} as NodeJS.ProcessEnv;
const png =
  "data:image/png;base64," + Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]).toString("base64");
const textModel = RUNWARE_MODELS.find((item) => item.capability === "text")!;

function input(
  capability: string,
  model: string,
  prompt = "Hi",
  extras: Record<string, unknown> = {},
) {
  return { capability, model, prompt, confirmed: true, requestId: uuid(), ...extras };
}

test("allowlist is strict and configured status requires key plus allowlist", () => {
  assert.deepEqual([...parseAllowedUserIds(" a, ,b ")], ["a", "b"]);
  assert.equal(
    isRunwareEnabledForUser("alice", { RUNWARE_API_KEY: "x" } as NodeJS.ProcessEnv),
    false,
  );
  assert.equal(
    isRunwareEnabledForUser("alice", { RUNWARE_ALLOWED_USER_IDS: "alice" } as NodeJS.ProcessEnv),
    false,
  );
  assert.equal(
    getRunwareStatusForUser("alice", { RUNWARE_API_KEY: "x" } as NodeJS.ProcessEnv).available,
    false,
  );
  assert.equal(getRunwareStatusForUser("mallory", allowEnv).available, false);
  const status = getRunwareStatusForUser("alice", allowEnv);
  assert.equal(
    status.available,
    false,
    "paid execution is disabled without a technically enforceable request cost cap",
  );
  assert.match(status.reason, /Preisobergrenze/);
  assert.equal(status.reason.includes("secret"), false);
  assert.equal(
    status.models.length,
    RUNWARE_MODELS.length,
    "authorized models remain available for UI review while execution is gated",
  );
});

test("data URI validation enforces PNG signature, allowed URI scheme and 1MB maximum", () => {
  assert.doesNotThrow(() => validateImageDataUri(png));
  assert.throws(() => validateImageDataUri("https://127.0.0.1/private.png"));
  const maximum = Buffer.alloc(1024 * 1024);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(maximum);
  assert.doesNotThrow(() =>
    validateImageDataUri("data:image/png;base64," + maximum.toString("base64")),
  );
  assert.throws(() =>
    validateImageDataUri(
      "data:image/png;base64," + Buffer.concat([maximum, Buffer.alloc(1)]).toString("base64"),
    ),
  );
  assert.throws(() =>
    validateImageDataUri("data:image/png;base64," + Buffer.from("not png").toString("base64")),
  );
});

test("no video capability/model and image analysis is transparently unsupported", () => {
  assert.equal(
    RUNWARE_MODELS.some((model) => /video/i.test(model.id)),
    false,
  );
  assert.equal(
    RUNWARE_CAPABILITIES.some((capability) => capability.id === "video"),
    false,
  );
  assert.equal(
    RUNWARE_MODELS.some((model) => model.capability === "image-analysis"),
    false,
  );
  assert.equal(RUNWARE_TEXT_STREAMING_AVAILABLE, true);
  assert.equal(RUNWARE_COST_LIMIT_AVAILABLE, false);
});

test("text task body is fixed, bounded and includes actual-cost reporting, with no fake estimate", () => {
  const request = input("text", textModel.id, "Hallo");
  const task = makeRunwareTask(request);
  assert.equal(task.taskType, "textInference");
  assert.equal(task.model, textModel.id);
  assert.equal(task.includeCost, true);
  assert.equal(task.deliveryMethod, undefined);
  assert.deepEqual(task.settings, { maxTokens: 1024, temperature: 0.7 });
  assert.equal(task.taskUUID, request.requestId);
});

test("edit and upscale use only fixed, documented data-URI request shapes", () => {
  const editModel = RUNWARE_MODELS.find((item) => item.capability === "image-editing")!;
  const upscaleModel = RUNWARE_MODELS.find((item) => item.capability === "image-upscale")!;
  const edit = makeRunwareTask(input("image-editing", editModel.id, "Edit", { inputImage: png }));
  assert.equal(edit.taskType, "imageInference");
  assert.deepEqual(edit.inputs, { referenceImages: [png] });
  const upscale = makeRunwareTask(
    input("image-upscale", upscaleModel.id, "Upscale", { inputImage: png }),
  );
  assert.equal(upscale.taskType, "upscale");
  assert.deepEqual(upscale.inputs, { image: png });
  assert.equal(upscale.upscaleFactor, 2);
  assert.deepEqual(upscale.settings, { enhanceDetails: true, realism: true });
});

test("maps results without exposing provider errors or invalid media URLs", () => {
  const req = input("text", textModel.id, "hi");
  const result = mapRunwareResponse(
    { data: [{ taskUUID: req.requestId, text: "Hallo", cost: 0.00012 }] },
    req,
  );
  assert.deepEqual(result, {
    id: req.requestId,
    capability: "text",
    model: textModel.id,
    kind: "text",
    text: "Hallo",
    cost: 0.00012,
  });
  const imgModel = RUNWARE_MODELS.find((item) => item.capability === "image-generation")!;
  const imageReq = input("image-generation", imgModel.id, "a mountain");
  assert.equal(
    mapRunwareResponse(
      { data: [{ taskUUID: imageReq.requestId, imageURL: "https://im.runware.ai/result.png" }] },
      imageReq,
    ).kind,
    "image",
  );
  assert.throws(() =>
    mapRunwareResponse(
      { data: [{ taskUUID: imageReq.requestId, imageURL: "http://127.0.0.1/x" }] },
      imageReq,
    ),
  );
  assert.throws(
    () =>
      mapRunwareResponse(
        { errors: [{ code: "invalidApiKey", message: "secret-test-key detail" }] },
        req,
      ),
    (error: Error) =>
      !error.message.includes("secret-test-key") && !error.message.includes("invalidApiKey"),
  );
});

test("rejects unapproved users, untrusted models, unconfirmed requests, long prompts and arbitrary URLs", () => {
  assert.throws(() => makeRunwareTask(input("text", "untrusted-model")));
  assert.throws(() => makeRunwareTask({ ...input("text", textModel.id), confirmed: false }));
  assert.throws(() => makeRunwareTask(input("text", textModel.id, "x".repeat(4001))));
  assert.throws(() =>
    makeRunwareTask(
      input("image-editing", "prunaai:2@1", "Edit", { inputImage: "http://127.0.0.1/private" }),
    ),
  );
  assert.equal(isRunwareEnabledForUser("mallory", allowEnv), false);
});

test("authenticated execution core rejects non-allowlisted identity without a provider request", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    throw new Error("unexpected provider request");
  }) as typeof fetch;
  try {
    await assert.rejects(
      executeRunwareForUser("mallory", input("text", textModel.id), allowEnv),
      /nicht eingerichtet/,
    );
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = original;
  }
});

test("idempotent request IDs deduplicate blocked work; changed payload with same ID is rejected and nothing calls fetch", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    throw new Error("unexpected provider request");
  }) as typeof fetch;
  try {
    const request = input("text", textModel.id, "once");
    const first = executeRunwareForUser("test-a", request, allowEnv);
    await assert.rejects(first, /Preisobergrenze/);
    await assert.rejects(executeRunwareForUser("test-a", request, allowEnv), /Preisobergrenze/);
    await assert.rejects(
      executeRunwareForUser("test-a", { ...request, prompt: "different" }, allowEnv),
      /Request-ID/,
    );
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = original;
  }
});

test("stream endpoint emits a documented NDJSON error frame and never calls provider without a cost ceiling", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    throw new Error("unexpected provider request");
  }) as typeof fetch;
  try {
    const response = streamRunwareForUser(
      "alice",
      input("text", textModel.id, "stream test"),
      allowEnv,
    );
    assert.equal(response.headers.get("content-type"), "application/x-ndjson; charset=utf-8");
    const frame = JSON.parse((await response.text()).trim());
    assert.equal(frame.type, "error");
    assert.match(frame.message, /Preisobergrenze/);
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = original;
  }
});

test("protected server-function declarations require Supabase auth", async () => {
  const source = await import("../src/lib/runware.functions");
  assert.ok(source.getRunwareStatus);
  assert.ok(source.runMiraRunware);
  assert.ok(source.streamMiraRunware);
  const fs = await import("node:fs/promises");
  const text = await fs.readFile(
    new URL("../src/lib/runware.functions.ts", import.meta.url),
    "utf8",
  );
  assert.equal((text.match(/\.middleware\(\[requireSupabaseAuth\]\)/g) ?? []).length, 3);
});

test("provider task IDs are stable per account and isolated across accounts", () => {
  const id = uuid();
  assert.equal(scopedRunwareTaskId("alice", id), scopedRunwareTaskId("alice", id));
  assert.notEqual(scopedRunwareTaskId("alice", id), scopedRunwareTaskId("bob", id));
  assert.match(
    scopedRunwareTaskId("alice", id),
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
});
