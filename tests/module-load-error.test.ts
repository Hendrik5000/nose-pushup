import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isDynamicImportFetchError } from "../src/lib/module-load-error";

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

test("the root boundary refreshes the document only after the module-recovery button is clicked", () => {
  const root = readFileSync(new URL("../src/routes/__root.tsx", import.meta.url), "utf8");
  assert.match(root, /const moduleLoadError = isDynamicImportFetchError\(error\);/);
  assert.match(
    root,
    /onClick=\{\(\) => \{\s*if \(moduleLoadError\) \{\s*window\.location\.reload\(\);\s*return;\s*\}\s*router\.invalidate\(\);\s*reset\(\);/,
  );
  assert.match(root, /\{moduleLoadError \? "App aktualisieren" : "Erneut versuchen"\}/);
  assert.equal((root.match(/window\.location\.reload\(\)/g) ?? []).length, 1);
});
