import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  isDynamicImportFetchError,
  shouldAutomaticallyRetryModuleLoad,
} from "../src/lib/module-load-error";

const moduleMessages = [
  "Failed to fetch dynamically imported module: https://alo-web.lovable.app/assets/postfach-old.js",
  "error loading dynamically imported module: https://alo-web.lovable.app/assets/exercises-old.js",
  "Importing a module script failed.",
];

test("recognizes browser dynamic module-fetch failures without assuming their cause", () => {
  for (const message of moduleMessages) {
    assert.equal(isDynamicImportFetchError(new TypeError(message)), true);
    assert.equal(isDynamicImportFetchError({ message }), true);
  }
  assert.equal(isDynamicImportFetchError(`  ${moduleMessages[0]}  `), true);
});

test("does not turn ordinary auth, network or application errors into reloads", () => {
  for (const error of [
    new TypeError("Failed to fetch"),
    new Error("Invalid login credentials"),
    new TypeError("Cannot read properties of undefined"),
    new Error("Unexpected token in module"),
    new Error("The provided applicationServerKey is not valid."),
    new Error("Failed to fetch dynamically imported module settings from database"),
    null,
    undefined,
    {},
    { message: 404 },
  ]) {
    assert.equal(isDynamicImportFetchError(error), false);
  }
});

test("automatically retries an online route-chunk failure only once per path and chunk", () => {
  const error = new TypeError(moduleMessages[0]);
  const identity = `/postfach\n${moduleMessages[0]}`;
  assert.equal(
    shouldAutomaticallyRetryModuleLoad(error, {
      online: true,
      pathname: "/postfach",
      previousAttempt: null,
      now: 10_000,
    }),
    true,
  );
  assert.equal(
    shouldAutomaticallyRetryModuleLoad(error, {
      online: false,
      pathname: "/postfach",
      previousAttempt: null,
      now: 10_000,
    }),
    false,
  );
  assert.equal(
    shouldAutomaticallyRetryModuleLoad(error, {
      online: true,
      pathname: "/postfach",
      previousAttempt: { identity, attemptedAt: 9_999 },
      now: 10_000,
    }),
    false,
  );
  assert.equal(
    shouldAutomaticallyRetryModuleLoad(error, {
      online: true,
      pathname: "/postfach",
      previousAttempt: { identity, attemptedAt: 1_000 },
      now: 61_000,
    }),
    true,
  );
  assert.equal(
    shouldAutomaticallyRetryModuleLoad(new TypeError("Failed to fetch"), {
      online: true,
      pathname: "/postfach",
      previousAttempt: null,
      now: 10_000,
    }),
    false,
  );
});

test("the root boundary keeps its manual recovery screen after an automatic retry", () => {
  const root = readFileSync(new URL("../src/routes/__root.tsx", import.meta.url), "utf8");
  assert.match(root, /const moduleLoadError = isDynamicImportFetchError\(error\);/);
  assert.match(root, /installModuleLoadRecovery\(window\)/);
  assert.match(
    root,
    /onClick=\{\(\) => \{\s*if \(moduleLoadError\) \{\s*window\.location\.reload\(\);\s*return;\s*\}\s*router\.invalidate\(\);\s*reset\(\);/,
  );
  assert.match(root, /\{moduleLoadError \? "App aktualisieren" : "Erneut versuchen"\}/);
  assert.equal((root.match(/window\.location\.reload\(\)/g) ?? []).length, 1);
});
