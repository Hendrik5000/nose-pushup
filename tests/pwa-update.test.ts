import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  ACTIVATE_WAITING_WORKER_MESSAGE,
  requestWaitingWorkerActivation,
} from "../src/lib/pwa-update";

test("a missing waiting worker cannot start an update", () => {
  assert.equal(requestWaitingWorkerActivation(null), false);
  assert.equal(requestWaitingWorkerActivation(undefined), false);
});

test("the user action sends only the explicit activation message", () => {
  const messages: unknown[] = [];
  const worker = { postMessage: (message: unknown) => messages.push(message) };
  assert.equal(requestWaitingWorkerActivation(worker), true);
  assert.deepEqual(messages, [{ type: ACTIVATE_WAITING_WORKER_MESSAGE }]);
});

test("a messaging failure is reported to the caller without throwing", () => {
  const worker = {
    postMessage: () => {
      throw new Error("worker stopped");
    },
  };
  assert.equal(requestWaitingWorkerActivation(worker), false);
});

test("service worker activation stays alive until the waiting worker can skip waiting", () => {
  const source = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8");
  const handler = source.match(
    /self\.addEventListener\("message", \(event\) => \{([\s\S]*?)\n\}\);/,
  )?.[1];
  assert.match(handler ?? "", /event\.waitUntil\(self\.skipWaiting\(\)\)/);
});
