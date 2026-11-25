import assert from "node:assert/strict";
import test from "node:test";
import {
  consumeAdminAccessDeniedNotice,
  markAdminAccessDeniedNotice,
} from "../src/lib/admin-access-notice";

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

test("admin denial notice is stored once and consumed once", () => {
  const storage = createStorage();

  markAdminAccessDeniedNotice(() => storage);

  assert.equal(
    consumeAdminAccessDeniedNotice(() => storage),
    true,
  );
  assert.equal(
    consumeAdminAccessDeniedNotice(() => storage),
    false,
  );
});

test("admin denial notice helpers tolerate unavailable browser storage", () => {
  const unavailableStorage = () => {
    throw new Error("Storage is unavailable");
  };

  assert.doesNotThrow(() => markAdminAccessDeniedNotice(unavailableStorage));
  assert.equal(consumeAdminAccessDeniedNotice(unavailableStorage), false);
});
